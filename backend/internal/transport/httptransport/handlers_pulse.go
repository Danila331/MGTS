package httptransport

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	"mgts/backend/internal/modules/core/domain"
	"mgts/backend/internal/modules/core/usecase"
)

type ServerOptions struct {
	Auth      *JWTAuth
	Tally     usecase.TallyConfig
	Candidate usecase.CandidateReader
}

func (h *handler) tallyWebhook(c echo.Context) error {
	if !h.options.Tally.Enabled() {
		return domain.ErrNotFound
	}
	raw, err := io.ReadAll(c.Request().Body)
	if err != nil {
		return err
	}
	signature, err := base64.StdEncoding.DecodeString(c.Request().Header.Get("Tally-Signature"))
	mac := hmac.New(sha256.New, []byte(h.options.Tally.Secret))
	mac.Write(raw)
	if err != nil || !hmac.Equal(mac.Sum(nil), signature) {
		return domain.ErrUnauthorized
	}
	var event usecase.TallySubmission
	if err := json.Unmarshal(raw, &event); err != nil {
		return domain.ErrValidation
	}
	ctx, cancel := context.WithTimeout(c.Request().Context(), 8*time.Second)
	defer cancel()
	duplicate, err := h.svc.ImportTally(ctx, event, h.options.Tally)
	if errors.Is(err, context.DeadlineExceeded) {
		return domain.ErrUnavailable
	}
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, map[string]bool{"duplicate": duplicate})
}

func (h *handler) tallyInvites(c echo.Context) error {
	if err := requireExplicitHR(c); err != nil {
		return err
	}
	items, err := h.svc.TallyInvites(c.Request().Context(), actor(c).ID, c.Param("id"), h.options.Tally)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, map[string]any{"enabled": h.options.Tally.Enabled(), "items": items})
}

func (h *handler) integrationStatus(c echo.Context) error {
	if err := requireExplicitHR(c); err != nil {
		return err
	}
	return c.JSON(http.StatusOK, map[string]bool{"tally": h.options.Tally.Enabled(), "huntflow": h.options.Candidate != nil})
}

func (h *handler) candidate(c echo.Context) error {
	if err := requireExplicitHR(c); err != nil {
		return err
	}
	if h.options.Candidate == nil {
		return c.JSON(http.StatusOK, map[string]any{"enabled": false, "profile": nil})
	}
	result, err := h.svc.Candidate(c.Request().Context(), actor(c).ID, c.Param("id"), h.options.Candidate)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, map[string]any{"enabled": true, "profile": result})
}

func (h *handler) linkCandidate(c echo.Context) error {
	if err := requireExplicitHR(c); err != nil {
		return err
	}
	if h.options.Candidate == nil {
		return domain.ErrUnavailable
	}
	var input struct {
		CandidateID *int `json:"candidate_id"`
	}
	if err := c.Bind(&input); err != nil || input.CandidateID == nil {
		return domain.ErrValidation
	}
	result, err := h.svc.LinkCandidate(c.Request().Context(), actor(c).ID, c.Param("id"), *input.CandidateID, h.options.Candidate)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, map[string]any{"enabled": true, "profile": result})
}

func (h *handler) surveyFollowUp(c echo.Context) error {
	if err := requireExplicitHR(c); err != nil {
		return err
	}
	var input struct {
		Status        string `json:"status"`
		Note          string `json:"note"`
		ReviewVersion string `json:"review_version"`
	}
	if err := c.Bind(&input); err != nil {
		return err
	}
	result, err := h.svc.UpdateSurveyFollowUp(c.Request().Context(), actor(c).ID, c.Param("id"), input.Status, input.Note, input.ReviewVersion)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, result)
}
