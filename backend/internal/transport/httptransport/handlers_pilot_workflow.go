package httptransport

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"mgts/backend/internal/modules/core/domain"
)

func (h *handler) surveyReminders(c echo.Context) error {
	items, err := h.svc.SurveyReminders(c.Request().Context(), actor(c).ID)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, map[string]any{"items": items})
}

func (h *handler) remindSurvey(c echo.Context) error {
	if err := requireExplicitHR(c); err != nil {
		return err
	}
	var input struct {
		InternshipID string `json:"internship_id"`
		Wave         int    `json:"wave"`
	}
	if err := c.Bind(&input); err != nil {
		return err
	}
	sent, err := h.svc.RemindSurvey(c.Request().Context(), actor(c).ID, input.InternshipID, input.Wave)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, map[string]int{"sent": sent})
}

func (h *handler) finalRecap(c echo.Context) error {
	if err := requireExplicitHR(c); err != nil {
		return err
	}
	result, err := h.svc.FinalRecap(c.Request().Context(), actor(c).ID, c.Param("id"))
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, result)
}

func (h *handler) saveFinalRecap(c echo.Context) error {
	if err := requireExplicitHR(c); err != nil {
		return err
	}
	var input domain.InternshipRecap
	if err := c.Bind(&input); err != nil {
		return err
	}
	result, err := h.svc.SaveFinalRecap(c.Request().Context(), actor(c).ID, c.Param("id"), input)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, result)
}

func (h *handler) hrContacts(c echo.Context) error {
	if err := requireExplicitHR(c); err != nil {
		return err
	}
	items, err := h.svc.HRContacts(c.Request().Context(), actor(c).ID)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, map[string]any{"items": items})
}

func (h *handler) contactHR(c echo.Context) error {
	var input struct {
		SurveyID     string `json:"survey_id"`
		InternshipID string `json:"internship_id"`
		Message      string `json:"message"`
	}
	if err := c.Bind(&input); err != nil {
		return err
	}
	if err := h.svc.ContactHR(c.Request().Context(), actor(c).ID, input.SurveyID, input.InternshipID, input.Message); err != nil {
		return err
	}
	return c.JSON(http.StatusCreated, map[string]string{"recipient": "hr"})
}

func (h *handler) mentorCommentAdvice(c echo.Context) error {
	var input struct {
		QuestionID string `json:"question_id"`
		Text       string `json:"text"`
	}
	if err := c.Bind(&input); err != nil {
		return err
	}
	result, err := h.svc.AdviseMentorComment(c.Request().Context(), actor(c).ID, c.Param("id"),
		c.QueryParam("internship_id"), input.QuestionID, input.Text)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, result)
}
