package usecase

import (
	"context"
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"

	analytics "mgts/backend/internal/modules/analytics/usecase"
	"mgts/backend/internal/modules/core/domain"
)

type SurveyImportTable struct {
	Name string
	Rows [][]string
}

type SurveyExportTable struct {
	Role domain.Role
	Name string
	Rows [][]any
}

type SurveyImportResult struct {
	Imported int `json:"imported"`
	Skipped  int `json:"skipped"`
}

type pulseColumn struct {
	header, dimension, kind string
}

type pulseTable struct {
	role    domain.Role
	name    string
	columns []pulseColumn
}

const (
	internHeader     = "ID стажера"
	mentorHeader     = "ID наставника"
	departmentHeader = "Подразделение / направление стажировки"
	periodHeader     = "Контрольный период"
)

var pulseTables = []pulseTable{
	{domain.RoleIntern, "Ответы стажеров", []pulseColumn{
		{"Понятность задач", "clarity", "scale"},
		{"Поддержка и обратная связь наставника", "support", "scale"},
		{"Комфортность нагрузки", "workload", "scale"},
		{"Интерес к задачам", "interest", "scale"},
		{"Профессиональное развитие", "growth", "scale"},
		{"Взаимодействие с командой", "team", "scale"},
		{"Общая удовлетворенность стажировкой", "satisfaction", "scale"},
		{"Сложности за период", "difficulties", "text"},
		{"Что мешает работать и развиваться", "blockers", "text"},
	}},
	{domain.RoleMentor, "Оценки наставников", []pulseColumn{
		{"Понимание задач и ожиданий", "understanding", "scale"},
		{"Качество выполнения задач", "quality", "scale"},
		{"Самостоятельность", "independence", "scale"},
		{"Соблюдение сроков и организация работы", "deadlines", "scale"},
		{"Вовлеченность и инициативность", "engagement", "scale"},
		{"Взаимодействие с наставником и командой", "communication", "scale"},
		{"Комментарий о работе за период", "comment", "text"},
		{"Сложности / ситуации для внимания", "attention", "text"},
	}},
}

func (table pulseTable) headers() []string {
	headers := []string{internHeader, departmentHeader, periodHeader}
	if table.role == domain.RoleMentor {
		headers = append([]string{mentorHeader}, headers...)
	}
	for _, column := range table.columns {
		headers = append(headers, column.header)
	}
	return headers
}

func (table pulseTable) questions(survey domain.Survey) ([]domain.Question, bool) {
	if survey.Audience != table.role || len(survey.Questions) != len(table.columns) {
		return nil, false
	}
	questions := make([]domain.Question, 0, len(table.columns))
	for _, column := range table.columns {
		var match domain.Question
		for _, question := range survey.Questions {
			if question.Dimension == column.dimension && question.Type == column.kind {
				if match.ID != "" {
					return nil, false
				}
				match = question
			}
		}
		if match.ID == "" || (column.kind == "scale" && (match.Min != 1 || match.Max != 5)) {
			return nil, false
		}
		questions = append(questions, match)
	}
	return questions, true
}

type pulseKey struct {
	internship string
	wave       int
	role       domain.Role
}

func pulseResponses(state *domain.State, table pulseTable) map[pulseKey]domain.Response {
	responses := map[pulseKey]domain.Response{}
	for _, response := range state.Responses {
		if response.Status != "submitted" || response.Role != table.role || response.Wave < 1 || response.Wave > 6 {
			continue
		}
		if _, ok := table.questions(state.Surveys[response.SurveyID]); !ok {
			continue
		}
		key := pulseKey{response.InternshipID, response.Wave, response.Role}
		previous := responses[key]
		if previous.ID == "" || response.UpdatedAt.After(previous.UpdatedAt) ||
			(response.UpdatedAt.Equal(previous.UpdatedAt) && response.ID > previous.ID) {
			responses[key] = response
		}
	}
	return responses
}

func (s *Service) ExportSurveyResponses(ctx context.Context, actorID string) ([]SurveyExportTable, error) {
	state, err := s.store.Snapshot(ctx)
	if err != nil {
		return nil, err
	}
	if err := s.requireSurveyHR(state, actorID); err != nil {
		return nil, err
	}
	exports := make([]SurveyExportTable, 0, len(pulseTables))
	for _, table := range pulseTables {
		var responses []domain.Response
		for _, response := range pulseResponses(state, table) {
			if _, ok := state.Internships[response.InternshipID]; ok {
				responses = append(responses, response)
			}
		}
		sort.Slice(responses, func(i, j int) bool {
			a, b := responses[i], responses[j]
			internA, internB := state.Internships[a.InternshipID].Intern.ID, state.Internships[b.InternshipID].Intern.ID
			if internA != internB {
				return internA < internB
			}
			if a.Wave != b.Wave {
				return a.Wave < b.Wave
			}
			return a.InternshipID < b.InternshipID
		})
		var header []any
		for _, name := range table.headers() {
			header = append(header, name)
		}
		result := SurveyExportTable{Role: table.role, Name: table.name, Rows: [][]any{header}}
		for _, response := range responses {
			internship := state.Internships[response.InternshipID]
			row := []any{internship.Intern.ID, internship.Team, fmt.Sprintf("Месяц %d", response.Wave)}
			if table.role == domain.RoleMentor {
				row = append([]any{response.RespondentID}, row...)
			}
			questions, _ := table.questions(state.Surveys[response.SurveyID])
			for _, question := range questions {
				row = append(row, response.Answers[question.ID])
			}
			result.Rows = append(result.Rows, row)
		}
		exports = append(exports, result)
	}
	return exports, nil
}

func (s *Service) ImportSurveyResponses(ctx context.Context, actorID string, tables []SurveyImportTable) (SurveyImportResult, error) {
	var result SurveyImportResult
	err := s.store.Update(ctx, func(state *domain.State) error {
		if err := s.requireSurveyHR(state, actorID); err != nil {
			return err
		}
		responses := map[pulseKey]domain.Response{}
		for _, table := range pulseTables {
			for key, response := range pulseResponses(state, table) {
				responses[key] = response
			}
		}
		for _, table := range tables {
			if len(table.Rows) == 0 {
				continue
			}
			schema, columns, err := pulseHeaders(table.Rows[0])
			if err != nil {
				return invalid(fmt.Sprintf("%s: %v", table.Name, err))
			}
			for index, row := range table.Rows[1:] {
				if strings.TrimSpace(strings.Join(row, "")) == "" {
					continue
				}
				imported, err := s.importPulseRow(state, schema, columns, row, responses)
				if err != nil {
					return invalid(fmt.Sprintf("%s, строка %d: %v", table.Name, index+2, err))
				}
				if imported {
					result.Imported++
				} else {
					result.Skipped++
				}
			}
		}
		if result.Imported+result.Skipped == 0 {
			return invalid("В файле нет строк с ответами")
		}
		if result.Imported > 0 {
			state.Touch()
		}
		return ctx.Err()
	})
	if err != nil {
		return SurveyImportResult{}, err
	}
	return result, nil
}

func (s *Service) requireSurveyHR(state *domain.State, actorID string) error {
	actor, err := state.Actor(actorID)
	if err != nil {
		return err
	}
	if actor.Role != domain.RoleHR {
		return domain.ErrForbidden
	}
	return nil
}

func normalizePulseHeader(value string) string {
	return strings.ReplaceAll(strings.ToLower(strings.Join(strings.Fields(value), " ")), "ё", "е")
}

func pulseHeaders(row []string) (pulseTable, map[string]int, error) {
	columns := make(map[string]int, len(row))
	for index, cell := range row {
		name := normalizePulseHeader(cell)
		if name == "" {
			continue
		}
		if _, ok := columns[name]; ok {
			return pulseTable{}, nil, fmt.Errorf("повторяется колонка «%s»", cell)
		}
		columns[name] = index
	}
	table := pulseTables[0]
	if _, ok := columns[normalizePulseHeader(mentorHeader)]; ok {
		table = pulseTables[1]
	}
	for _, header := range table.headers() {
		if _, ok := columns[normalizePulseHeader(header)]; !ok {
			return pulseTable{}, nil, fmt.Errorf("не найдена колонка «%s»", header)
		}
	}
	return table, columns, nil
}

func (s *Service) importPulseRow(state *domain.State, table pulseTable, columns map[string]int, row []string, responses map[pulseKey]domain.Response) (bool, error) {
	cell := func(header string) string {
		if index := columns[normalizePulseHeader(header)]; index < len(row) {
			return row[index]
		}
		return ""
	}
	internID := strings.TrimSpace(cell(internHeader))
	department := strings.TrimSpace(cell(departmentHeader))
	internship, err := pulseInternship(state, internID, department)
	if err != nil {
		return false, err
	}
	period := strings.TrimPrefix(normalizePulseHeader(cell(periodHeader)), "месяц ")
	wave, err := strconv.Atoi(period)
	if err != nil || wave < 1 || wave > 6 {
		return false, fmt.Errorf("контрольный период должен быть от 1 до 6")
	}
	key := pulseKey{internship.ID, wave, table.role}
	prior := responses[key]
	respondentID := internID
	if table.role == domain.RoleMentor {
		respondentID = strings.TrimSpace(cell(mentorHeader))
	}
	respondent, ok := state.Actors[respondentID]
	if !ok || respondent.Role != table.role {
		return false, fmt.Errorf("участник «%s» не найден для этой анкеты", respondentID)
	}
	survey, assignment, err := surveyForPulseRow(state, table, key, respondentID, prior)
	if err != nil {
		return false, err
	}
	if table.role == domain.RoleMentor && respondentID != internship.MentorID && respondentID != prior.RespondentID && assignment.RespondentID != respondentID {
		return false, fmt.Errorf("наставник «%s» не назначен стажёру «%s»", respondentID, internID)
	}
	questions, _ := table.questions(survey)
	answers := make(map[string]any, len(questions))
	changed := prior.RespondentID != respondentID
	for index, question := range questions {
		column := table.columns[index]
		value := cell(column.header)
		if question.Type == "scale" {
			score, err := strconv.ParseFloat(strings.ReplaceAll(strings.TrimSpace(value), ",", "."), 64)
			if err != nil || math.IsNaN(score) || score < 1 || score > 5 {
				return false, fmt.Errorf("«%s» должна содержать оценку от 1 до 5", column.header)
			}
			answers[question.ID] = score
			old, ok := answerNumber(prior.Answers[question.ID])
			changed = changed || !ok || old != score
		} else {
			answers[question.ID] = value
			old, _ := prior.Answers[question.ID].(string)
			changed = changed || strings.ReplaceAll(old, "\r\n", "\n") != strings.ReplaceAll(value, "\r\n", "\n")
		}
	}
	if prior.ID != "" {
		if changed {
			return false, fmt.Errorf("ответ по стажёру «%s» за месяц %d уже сохранён с другими значениями", internID, wave)
		}
		return false, nil
	}
	now := s.now()
	if assignment.ID == "" {
		assignment = domain.Assignment{ID: state.NextID("assignment"), SurveyID: survey.ID, InternshipID: internship.ID, RespondentID: respondentID, DueAt: survey.DueAt}
	}
	response := domain.Response{ID: state.NextID("response"), SurveyID: survey.ID, AssignmentID: assignment.ID,
		InternshipID: internship.ID, RespondentID: respondentID, Respondent: respondent.Name, Role: table.role,
		Wave: wave, Answers: answers, Status: "submitted", Version: 1, CreatedAt: now, UpdatedAt: now}
	assignment.Status, assignment.SubmittedAt = "submitted", &now
	state.Assignments[assignment.ID] = assignment
	state.Responses[response.ID] = response
	internship.LastActivity = now
	state.Internships[internship.ID] = internship
	analytics.Recalculate(state, response)
	responses[key] = response
	return true, nil
}

func pulseInternship(state *domain.State, internID, department string) (domain.Internship, error) {
	var found domain.Internship
	for _, internship := range state.Internships {
		if internship.Intern.ID != internID || normalizePulseHeader(internship.Team) != normalizePulseHeader(department) {
			continue
		}
		if found.ID != "" {
			return domain.Internship{}, fmt.Errorf("у стажёра «%s» несколько стажировок в указанном подразделении", internID)
		}
		found = internship
	}
	if found.ID == "" {
		return domain.Internship{}, fmt.Errorf("стажёр «%s» не найден в подразделении «%s»", internID, department)
	}
	return found, nil
}

func surveyForPulseRow(state *domain.State, table pulseTable, key pulseKey, respondentID string, prior domain.Response) (domain.Survey, domain.Assignment, error) {
	if prior.ID != "" {
		return state.Surveys[prior.SurveyID], state.Assignments[prior.AssignmentID], nil
	}
	var target domain.Survey
	var assignment domain.Assignment
	for _, candidate := range state.Assignments {
		if candidate.InternshipID != key.internship || candidate.RespondentID != respondentID {
			continue
		}
		survey := state.Surveys[candidate.SurveyID]
		if !isPulseSurvey(table, survey, key.wave) {
			continue
		}
		if assignment.ID != "" {
			return domain.Survey{}, domain.Assignment{}, fmt.Errorf("найдено несколько назначений за месяц %d", key.wave)
		}
		target, assignment = survey, candidate
	}
	if assignment.ID != "" {
		return target, assignment, nil
	}
	for _, survey := range state.Surveys {
		if !isPulseSurvey(table, survey, key.wave) {
			continue
		}
		if target.ID != "" {
			return domain.Survey{}, domain.Assignment{}, fmt.Errorf("найдено несколько анкет за месяц %d", key.wave)
		}
		target = survey
	}
	if target.ID == "" {
		return domain.Survey{}, domain.Assignment{}, fmt.Errorf("нет подходящей анкеты Пульса за месяц %d", key.wave)
	}
	return target, assignment, nil
}

func isPulseSurvey(table pulseTable, survey domain.Survey, wave int) bool {
	if survey.Wave != wave || (survey.Status != "published" && survey.Status != "closed") {
		return false
	}
	_, ok := table.questions(survey)
	return ok
}
