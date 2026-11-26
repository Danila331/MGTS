package httptransport

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"mgts/backend/internal/modules/core/usecase"
)

func (h *handler) surveys(c echo.Context) error {
	result, err := h.svc.Surveys(c.Request().Context(), actor(c).ID)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, result)
}
func (h *handler) survey(c echo.Context) error {
	result, err := h.svc.Survey(c.Request().Context(), actor(c).ID, c.Param("id"))
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, result)
}
func (h *handler) createSurvey(c echo.Context) error {
	var body surveyDTO
	if err := c.Bind(&body); err != nil {
		return err
	}
	result, err := h.svc.CreateSurvey(c.Request().Context(), actor(c).ID, body.input())
	if err != nil {
		return err
	}
	return c.JSON(http.StatusCreated, result)
}
func (h *handler) patchSurvey(c echo.Context) error {
	var body surveyPatchDTO
	if err := c.Bind(&body); err != nil {
		return err
	}
	patch := usecase.SurveyPatch{Title: body.Title, Description: body.Description, Audience: body.Audience, Period: body.Period, DueAt: body.DueAt, Wave: body.Wave}
	if body.Questions != nil {
		questions := questionsFromDTO(*body.Questions)
		patch.Questions = &questions
	}
	result, err := h.svc.UpdateSurvey(c.Request().Context(), actor(c).ID, c.Param("id"), patch)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, result)
}
func (h *handler) deleteSurvey(c echo.Context) error {
	result, err := h.svc.DeleteSurvey(c.Request().Context(), actor(c).ID, c.Param("id"))
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, result)
}
func (h *handler) publishSurvey(c echo.Context) error {
	result, err := h.svc.PublishSurvey(c.Request().Context(), actor(c).ID, c.Param("id"))
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, result)
}
func (h *handler) assignSurvey(c echo.Context) error {
	var body assignDTO
	if err := c.Bind(&body); err != nil {
		return err
	}
	result, err := h.svc.AssignSurvey(c.Request().Context(), actor(c).ID, c.Param("id"), usecase.AssignInput{InternshipIDs: body.InternshipIDs, RespondentIDs: body.RespondentIDs, DueAt: body.DueAt})
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, map[string]any{"assignments": result})
}
func (h *handler) takeSurvey(c echo.Context) error {
	result, err := h.svc.TakeSurvey(c.Request().Context(), actor(c).ID, c.Param("id"), c.QueryParam("internship_id"))
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, result)
}
func (h *handler) saveDraft(c echo.Context) error {
	var body answersDTO
	if err := c.Bind(&body); err != nil {
		return err
	}
	result, err := h.svc.SaveDraft(c.Request().Context(), actor(c).ID, c.Param("id"), c.QueryParam("internship_id"), body.Answers)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, result)
}
func (h *handler) submitSurvey(c echo.Context) error {
	var body answersDTO
	if err := c.Bind(&body); err != nil {
		return err
	}
	result, err := h.svc.SubmitSurvey(c.Request().Context(), actor(c).ID, c.Param("id"), c.QueryParam("internship_id"), body.Answers)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, result)
}
