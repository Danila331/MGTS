package usecase

import (
	"context"
	"strings"
	"time"
	"unicode/utf8"

	"mgts/backend/internal/modules/core/domain"
)

type CommentAdvice struct {
	Source    string   `json:"source"`
	Questions []string `json:"questions"`
}

type mentorCommentAdvisor interface {
	MentorCommentAdvice(context.Context, string) ([]string, error)
}

func (s *Service) AdviseMentorComment(ctx context.Context, actorID, surveyID, internshipID, questionID, text string) (CommentAdvice, error) {
	text = strings.TrimSpace(text)
	if internshipID == "" || text == "" || utf8.RuneCountInString(text) > maxPilotText {
		return CommentAdvice{}, invalid("введите комментарий до 2000 символов")
	}
	state, err := s.store.Snapshot(ctx)
	if err != nil {
		return CommentAdvice{}, err
	}
	actor, err := s.actor(state, actorID)
	if err != nil {
		return CommentAdvice{}, err
	}
	if actor.Role != domain.RoleMentor {
		return CommentAdvice{}, domain.ErrForbidden
	}
	survey, _, err := s.takeAssignment(state, actor, surveyID, internshipID)
	if err != nil {
		return CommentAdvice{}, err
	}
	if survey.Audience != domain.RoleMentor || survey.Status != "published" {
		return CommentAdvice{}, domain.ErrForbidden
	}
	found := false
	for _, question := range survey.Questions {
		found = found || question.ID == questionID && question.Type == "text"
	}
	if !found {
		return CommentAdvice{}, invalid("выберите текстовый вопрос анкеты наставника")
	}
	if provider, ok := s.surveyAnalyzer.(mentorCommentAdvisor); ok {
		callCtx, cancel := context.WithTimeout(ctx, 8*time.Second)
		defer cancel()
		items, err := provider.MentorCommentAdvice(callCtx, text)
		if err == nil && len(items) > 0 && len(items) <= 3 {
			valid := true
			for i, item := range items {
				items[i] = strings.TrimSpace(item)
				valid = valid && strings.HasSuffix(items[i], "?") && utf8.RuneCountInString(items[i]) <= 180
			}
			if valid {
				return CommentAdvice{Source: "ai", Questions: items}, nil
			}
		}
	}
	return CommentAdvice{Source: "template", Questions: []string{
		"На какой задаче и в какой ситуации это было заметно?",
		"Что именно сделал стажёр и какую помощь получил?",
		"Какой результат удалось наблюдать?",
	}}, nil
}
