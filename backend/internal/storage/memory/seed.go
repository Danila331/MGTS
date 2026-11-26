package memory

import (
	"fmt"
	"time"

	analytics "mgts/backend/internal/modules/analytics/usecase"
	"mgts/backend/internal/modules/core/domain"
)

const (
	programName = "Пульс · МГТС"
	cohortID    = "cohort-mgts"
)

// Seed returns the complete historical MGTS dataset: five internships, six
// monthly waves and sixty submitted responses. No answers are generated randomly.
func Seed() *domain.State {
	s := domain.NewState()
	now := domain.Now()
	s.Cohorts[cohortID] = domain.Cohort{
		ID: cohortID, Name: "Стажировка МГТС", Program: programName,
		StartedAt: "2026-06-01", EndsAt: "2026-11-30",
	}
	addActor(s, domain.Actor{ID: "actor-hr", Name: "HR МГТС", Role: domain.RoleHR, Initials: "HR"})
	addActor(s, domain.Actor{ID: "actor-manager", Name: "Руководитель программы", Role: domain.RoleManager, Initials: "РП"})

	departments := []string{"Технический блок", "Коммерческий блок", "Административный блок", "HR-блок", "IT"}
	internNames := []string{"Алексей Волков", "Мария Соколова", "Игорь Орлов", "Анна Белова", "Дмитрий Егоров"}
	mentorNames := []string{"Ольга Смирнова", "Тимур Ахметов", "Елена Фролова", "Роман Захаров", "Павел Климов"}
	for index := 0; index < 5; index++ {
		number := index + 1
		internshipID := fmt.Sprintf("internship-%02d", number)
		internID := fmt.Sprintf("СТ-%03d", number)
		mentorID := fmt.Sprintf("Н-%03d", number)
		teamID := fmt.Sprintf("department-%02d", number)
		s.Teams[teamID] = domain.Team{ID: teamID, Name: departments[index]}
		intern := domain.Actor{ID: internID, Name: internNames[index], Role: domain.RoleIntern, TeamID: teamID, InternshipID: internshipID, Initials: initials(internNames[index])}
		mentor := domain.Actor{ID: mentorID, Name: mentorNames[index], Role: domain.RoleMentor, TeamID: teamID, Initials: initials(mentorNames[index])}
		addActor(s, intern)
		addActor(s, mentor)
		s.Internships[internshipID] = domain.Internship{
			ID:      internshipID,
			Intern:  domain.Person{ID: intern.ID, Name: intern.Name, Initials: intern.Initials},
			Program: programName, CohortID: cohortID, Cohort: s.Cohorts[cohortID].Name,
			TeamID: teamID, Team: departments[index], Stage: "final_review",
			ManagerID: "actor-manager", Manager: s.Actors["actor-manager"].Name,
			MentorID: mentor.ID, Mentor: mentor.Name, Progress: 100,
			LastActivity: now.Add(-time.Duration(index+1) * time.Hour),
		}
	}

	internQuestions := pulseInternQuestions()
	mentorQuestions := pulseMentorQuestions()
	for wave := 1; wave <= 6; wave++ {
		period := fmt.Sprintf("Месяц %d", wave)
		at := now.Add(-time.Duration(6-wave)*30*24*time.Hour - 24*time.Hour)
		s.Surveys[fmt.Sprintf("survey-intern-%d", wave)] = domain.Survey{
			ID: fmt.Sprintf("survey-intern-%d", wave), Title: "Пульс стажёра · " + period,
			Description: "Ежемесячная оценка опыта стажировки", Status: "published",
			Audience: domain.RoleIntern, Period: period, DueAt: at, Wave: wave,
			Questions: internQuestions, CreatedAt: at.Add(-7 * 24 * time.Hour), UpdatedAt: at,
		}
		s.Surveys[fmt.Sprintf("survey-mentor-%d", wave)] = domain.Survey{
			ID: fmt.Sprintf("survey-mentor-%d", wave), Title: "Анкета наставника · " + period,
			Description: "Ежемесячная оценка работы стажёра", Status: "published",
			Audience: domain.RoleMentor, Period: period, DueAt: at, Wave: wave,
			Questions: mentorQuestions, CreatedAt: at.Add(-7 * 24 * time.Hour), UpdatedAt: at,
		}
	}

	for index := 0; index < 5; index++ {
		internshipID := fmt.Sprintf("internship-%02d", index+1)
		internID := fmt.Sprintf("СТ-%03d", index+1)
		internship := s.Internships[internshipID]
		for wave, row := range internHistory[internID] {
			answers := map[string]any{
				"intern_difficulties": row.difficulties,
				"intern_blockers":     row.blockers,
			}
			for questionIndex, value := range row.scores {
				answers[internQuestions[questionIndex].ID] = value
			}
			seedResponse(s, internship, domain.RoleIntern, internID, wave+1, answers, now)
		}
		for wave, row := range mentorHistory[internID] {
			answers := map[string]any{
				"mentor_comment":   row.comment,
				"mentor_attention": row.attention,
			}
			for questionIndex, value := range row.scores {
				answers[mentorQuestions[questionIndex].ID] = value
			}
			seedResponse(s, internship, domain.RoleMentor, internship.MentorID, wave+1, answers, now)
		}
	}

	// Signals and actions are outside the simplified product. Recalculate remains
	// responsible for metric points; historical analytics do not seed legacy signals.
	s.Signals = map[string]domain.Signal{}
	s.Actions = map[string]domain.Action{}
	s.Settings.UpdatedAt = now
	s.Settings.UpdatedBy = "actor-hr"
	s.Touch()
	s.Normalize()
	return s
}

func seedResponse(s *domain.State, internship domain.Internship, role domain.Role, respondentID string, wave int, answers map[string]any, now time.Time) {
	kind := "intern"
	if role == domain.RoleMentor {
		kind = "mentor"
	}
	surveyID := fmt.Sprintf("survey-%s-%d", kind, wave)
	survey := s.Surveys[surveyID]
	number := internship.ID[len(internship.ID)-2:]
	assignmentID := fmt.Sprintf("assignment-%s-%s-%d", kind, number, wave)
	responseID := fmt.Sprintf("response-%s-%s-%d", kind, number, wave)
	created := survey.DueAt
	assignment := domain.Assignment{
		ID: assignmentID, SurveyID: surveyID, InternshipID: internship.ID,
		RespondentID: respondentID, Status: "submitted", DueAt: survey.DueAt, SubmittedAt: &created,
	}
	s.Assignments[assignmentID] = assignment
	response := domain.Response{
		ID: responseID, SurveyID: surveyID, AssignmentID: assignmentID,
		InternshipID: internship.ID, RespondentID: respondentID,
		Respondent: s.Actors[respondentID].Name, Role: role, Wave: wave,
		Answers: answers, Status: "submitted", Version: 1, CreatedAt: created, UpdatedAt: created,
	}
	s.Responses[responseID] = response
	analytics.Recalculate(s, response)
}

func pulseInternQuestions() []domain.Question {
	questions := []domain.Question{
		{ID: "intern_clarity", Type: "scale", Title: "Мне понятно, каких результатов от меня ожидают по текущим задачам.", Dimension: "clarity"},
		{ID: "intern_support", Type: "scale", Title: "Я получаю достаточно поддержки и обратной связи от наставника.", Dimension: "support"},
		{ID: "intern_workload", Type: "scale", Title: "Моя текущая загрузка комфортна и позволяет качественно выполнять задачи.", Dimension: "workload"},
		{ID: "intern_interest", Type: "scale", Title: "Мне интересны задачи, над которыми я работаю.", Dimension: "interest"},
		{ID: "intern_growth", Type: "scale", Title: "Я чувствую, что в процессе стажировки развиваю полезные для себя навыки.", Dimension: "growth"},
		{ID: "intern_team", Type: "scale", Title: "Мне комфортно взаимодействовать с командой.", Dimension: "team"},
		{ID: "intern_satisfaction", Type: "scale", Title: "В целом я доволен тем, как проходит моя стажировка.", Dimension: "satisfaction"},
		{ID: "intern_difficulties", Type: "text", Title: "С какими сложностями вы столкнулись за последний период стажировки?", Dimension: "difficulties"},
		{ID: "intern_blockers", Type: "text", Title: "Есть ли что-то в задачах, взаимодействии с наставником или командой, что сейчас мешает вам эффективно работать и развиваться?", Dimension: "blockers"},
	}
	return normalizePulseQuestions(questions)
}

func pulseMentorQuestions() []domain.Question {
	questions := []domain.Question{
		{ID: "mentor_understanding", Type: "scale", Title: "Насколько стажер понимает поставленные задачи и ожидаемый результат?", Dimension: "understanding"},
		{ID: "mentor_quality", Type: "scale", Title: "Насколько качественно стажер выполняет поставленные задачи?", Dimension: "quality"},
		{ID: "mentor_independence", Type: "scale", Title: "Насколько самостоятельно стажер выполняет поставленные задачи?", Dimension: "independence"},
		{ID: "mentor_deadlines", Type: "scale", Title: "Насколько стажер соблюдает сроки и организует свою работу?", Dimension: "deadlines"},
		{ID: "mentor_engagement", Type: "scale", Title: "Насколько стажер вовлечен в работу и проявляет инициативу?", Dimension: "engagement"},
		{ID: "mentor_communication", Type: "scale", Title: "Насколько эффективно стажер взаимодействует с наставником и командой?", Dimension: "communication"},
		{ID: "mentor_comment", Type: "text", Title: "Опишите, как стажер проявил себя за последний период: что получилось хорошо и с какими сложностями он столкнулся?", Dimension: "comment"},
		{ID: "mentor_attention", Type: "text", Title: "Есть ли сложности или ситуации, на которые, по вашему мнению, стоит обратить внимание? Если да, кратко опишите.", Dimension: "attention"},
	}
	return normalizePulseQuestions(questions)
}

func normalizePulseQuestions(questions []domain.Question) []domain.Question {
	for index := range questions {
		questions[index].Required = true
		questions[index].Version = 1
		if questions[index].Type == "scale" {
			questions[index].Min = 1
			questions[index].Max = 5
		}
	}
	return questions
}

func addActor(s *domain.State, actor domain.Actor) { s.Actors[actor.ID] = actor }

func initials(name string) string {
	var first, last rune
	word := 0
	for _, symbol := range name {
		if symbol == ' ' {
			word++
			continue
		}
		if word == 0 && first == 0 {
			first = symbol
		}
		if word == 1 && last == 0 {
			last = symbol
		}
	}
	if last == 0 {
		last = first
	}
	return string([]rune{first, last})
}
