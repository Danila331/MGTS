package httptransport

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"mgts/backend/internal/modules/core/usecase"
)

func (h *handler) feedback(c echo.Context) error {
	result, err := h.svc.FeedbackList(c.Request().Context(), actor(c).ID, c.QueryParam("box"))
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, result)
}
func (h *handler) createFeedback(c echo.Context) error {
	var body feedbackDTO
	if err := c.Bind(&body); err != nil {
		return err
	}
	result, err := h.svc.CreateFeedback(c.Request().Context(), actor(c).ID, body.input())
	if err != nil {
		return err
	}
	return c.JSON(http.StatusCreated, result)
}
func (h *handler) patchFeedback(c echo.Context) error {
	var body feedbackPatchDTO
	if err := c.Bind(&body); err != nil {
		return err
	}
	result, err := h.svc.UpdateFeedback(c.Request().Context(), actor(c).ID, c.Param("id"), usecase.FeedbackPatch{Relation: body.Relation, Frequency: body.Frequency, Sentiment: body.Sentiment, Strengths: body.Strengths, Growth: body.Growth, Text: body.Text})
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, result)
}
func (h *handler) publishFeedback(c echo.Context) error {
	result, err := h.svc.PublishFeedback(c.Request().Context(), actor(c).ID, c.Param("id"))
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, result)
}
func (h *handler) requestFeedback(c echo.Context) error {
	var body feedbackRequestDTO
	if err := c.Bind(&body); err != nil {
		return err
	}
	result, err := h.svc.RequestFeedback(c.Request().Context(), actor(c).ID, body.InternshipID, body.RecipientID, body.Message)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusCreated, result)
}
func (h *handler) feedbackSummary(c echo.Context) error {
	result, err := h.svc.SummarizeFeedback(c.Request().Context(), actor(c).ID, c.Param("id"))
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, result)
}
func (h *handler) signals(c echo.Context) error {
	result, err := h.svc.Signals(c.Request().Context(), actor(c).ID, usecase.SignalFilters{Status: c.QueryParam("status"), Urgency: c.QueryParam("urgency"), OwnerID: c.QueryParam("owner_id")})
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, result)
}
func (h *handler) signal(c echo.Context) error {
	result, err := h.svc.Signal(c.Request().Context(), actor(c).ID, c.Param("id"))
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, result)
}
func (h *handler) patchSignal(c echo.Context) error {
	var body signalPatchDTO
	if err := c.Bind(&body); err != nil {
		return err
	}
	result, err := h.svc.UpdateSignal(c.Request().Context(), actor(c).ID, c.Param("id"), usecase.SignalPatch{Status: body.Status, Urgency: body.Urgency, OwnerID: body.OwnerID, DueAt: body.DueAt})
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, result)
}
func (h *handler) createAction(c echo.Context) error {
	var body actionDTO
	if err := c.Bind(&body); err != nil {
		return err
	}
	result, err := h.svc.CreateAction(c.Request().Context(), actor(c).ID, c.Param("id"), usecase.ActionInput{Title: body.Title, OwnerID: body.OwnerID, DueAt: body.DueAt})
	if err != nil {
		return err
	}
	return c.JSON(http.StatusCreated, result)
}
func (h *handler) patchAction(c echo.Context) error {
	var body actionPatchDTO
	if err := c.Bind(&body); err != nil {
		return err
	}
	result, err := h.svc.UpdateAction(c.Request().Context(), actor(c).ID, c.Param("id"), usecase.ActionPatch{Status: body.Status, Result: body.Result, Comment: body.Comment})
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, result)
}
