package httptransport

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"mgts/backend/internal/modules/core/usecase"
)

func (h *handler) aiQuery(c echo.Context) error {
	var body aiQueryDTO
	if err := c.Bind(&body); err != nil {
		return err
	}
	result, err := h.svc.AIQuery(c.Request().Context(), actor(c).ID, body.Question, body.InternshipID)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, result)
}
func (h *handler) aiAnalyze(c echo.Context) error {
	var body aiAnalyzeDTO
	if err := c.Bind(&body); err != nil {
		return err
	}
	result, err := h.svc.AIAnalyze(c.Request().Context(), actor(c).ID, body.Kind, body.Text, body.ContextID)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, result)
}
func (h *handler) aiEdit(c echo.Context) error {
	var body aiEditDTO
	if err := c.Bind(&body); err != nil {
		return err
	}
	result, err := h.svc.AIEdit(c.Request().Context(), actor(c).ID, body.Text, body.Instruction)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, result)
}
func (h *handler) integrations(c echo.Context) error {
	result, err := h.svc.Integrations(c.Request().Context(), actor(c).ID)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, result)
}
func (h *handler) syncIntegration(c echo.Context) error {
	result, err := h.svc.SyncIntegration(c.Request().Context(), actor(c).ID, c.Param("id"))
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, result)
}
func (h *handler) importSurvey(c echo.Context) error {
	var body externalResponseDTO
	if err := c.Bind(&body); err != nil {
		return err
	}
	result, duplicate, err := h.svc.ImportExternalResponse(c.Request().Context(), usecase.ExternalResponseInput{ExternalID: body.ExternalID, SurveyID: body.SurveyID, InternshipID: body.InternshipID, RespondentID: body.RespondentID, Version: body.Version, Answers: body.Answers})
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, map[string]any{"response": result, "duplicate": duplicate})
}
func (h *handler) settings(c echo.Context) error {
	result, err := h.svc.Settings(c.Request().Context(), actor(c).ID)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, result)
}
func (h *handler) patchSettings(c echo.Context) error {
	var body settingsPatchDTO
	if err := c.Bind(&body); err != nil {
		return err
	}
	result, err := h.svc.UpdateSettings(c.Request().Context(), actor(c).ID, usecase.SettingsPatch{ShowFeedbackToIntern: body.ShowFeedbackToIntern, SignalThresholds: body.SignalThresholds, ScaleMin: body.ScaleMin, ScaleMax: body.ScaleMax})
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, result)
}
