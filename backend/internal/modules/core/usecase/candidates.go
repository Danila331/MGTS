package usecase

import (
	"context"

	"mgts/backend/internal/modules/core/domain"
)

type CandidateProfile struct {
	ID       int    `json:"id"`
	Position string `json:"position"`
	URL      string `json:"url,omitempty"`
	Feedback int    `json:"recent_feedback"`
}

type CandidateReader interface {
	ReadCandidate(context.Context, int) (CandidateProfile, error)
}

func (s *Service) Candidate(ctx context.Context, actorID, internshipID string, reader CandidateReader) (*CandidateProfile, error) {
	state, err := s.store.Snapshot(ctx)
	if err != nil {
		return nil, err
	}
	if err := s.requireSurveyHR(state, actorID); err != nil {
		return nil, err
	}
	if _, ok := state.Internships[internshipID]; !ok {
		return nil, domain.ErrNotFound
	}
	id := state.CandidateLinks[internshipID]
	if id == 0 {
		return nil, nil
	}
	profile, err := reader.ReadCandidate(ctx, id)
	if err != nil {
		return nil, err
	}
	return &profile, nil
}

func (s *Service) LinkCandidate(ctx context.Context, actorID, internshipID string, id int, reader CandidateReader) (*CandidateProfile, error) {
	if id < 0 {
		return nil, invalid("ID кандидата должен быть положительным")
	}
	state, err := s.store.Snapshot(ctx)
	if err != nil {
		return nil, err
	}
	if err := s.requireSurveyHR(state, actorID); err != nil {
		return nil, err
	}
	if _, ok := state.Internships[internshipID]; !ok {
		return nil, domain.ErrNotFound
	}
	previous := state.CandidateLinks[internshipID]
	var profile *CandidateProfile
	if id != 0 {
		item, err := reader.ReadCandidate(ctx, id)
		if err != nil {
			return nil, err
		}
		profile = &item
	}
	err = s.store.Update(ctx, func(state *domain.State) error {
		if err := s.requireSurveyHR(state, actorID); err != nil {
			return err
		}
		if _, ok := state.Internships[internshipID]; !ok {
			return domain.ErrNotFound
		}
		if state.CandidateLinks[internshipID] != previous {
			return domain.ErrConflict
		}
		if id == previous {
			return nil
		}
		if id == 0 {
			delete(state.CandidateLinks, internshipID)
		} else {
			state.CandidateLinks[internshipID] = id
		}
		journalID := state.NextID("journal")
		state.Journal[journalID] = domain.JournalEntry{ID: journalID, IntegrationID: "huntflow", Event: "candidate_link_changed",
			Status: "success", Message: internshipID + " · " + actorID, CreatedAt: s.now(), Items: 1}
		state.Touch()
		return nil
	})
	if err != nil {
		return nil, err
	}
	return profile, nil
}
