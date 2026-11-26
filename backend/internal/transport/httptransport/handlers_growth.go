package httptransport

import (
	"net/http"

	"github.com/labstack/echo/v4"
	"mgts/backend/internal/modules/core/usecase"
)

func (h *handler) reviews(c echo.Context) error {
	result, err := h.svc.Reviews(c.Request().Context(), actor(c).ID)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, result)
}
func (h *handler) review(c echo.Context) error {
	result, err := h.svc.Review(c.Request().Context(), actor(c).ID, c.Param("id"))
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, result)
}
func (h *handler) createReview(c echo.Context) error {
	var body reviewDTO
	if err := c.Bind(&body); err != nil {
		return err
	}
	result, err := h.svc.CreateReview(c.Request().Context(), actor(c).ID, body.input())
	if err != nil {
		return err
	}
	return c.JSON(http.StatusCreated, result)
}
func (h *handler) patchReview(c echo.Context) error {
	var body reviewPatchDTO
	if err := c.Bind(&body); err != nil {
		return err
	}
	result, err := h.svc.UpdateReview(c.Request().Context(), actor(c).ID, c.Param("id"), usecase.ReviewPatch{Text: body.Text, ManagerReasoning: body.ManagerReasoning, RecommendedLevel: body.RecommendedLevel, Score: body.Score, Status: body.Status})
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, result)
}
func (h *handler) analyzeReview(c echo.Context) error {
	result, err := h.svc.AnalyzeReview(c.Request().Context(), actor(c).ID, c.Param("id"))
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, result)
}
func (h *handler) calibrateReview(c echo.Context) error {
	var body calibrateDTO
	if err := c.Bind(&body); err != nil {
		return err
	}
	result, err := h.svc.CalibrateReview(c.Request().Context(), actor(c).ID, c.Param("id"), body.Level, body.Score)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, result)
}
func (h *handler) announceReview(c echo.Context) error {
	result, err := h.svc.AnnounceReview(c.Request().Context(), actor(c).ID, c.Param("id"))
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, result)
}
func (h *handler) diagnostics(c echo.Context) error {
	result, err := h.svc.Diagnostics(c.Request().Context(), actor(c).ID)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, result)
}
func (h *handler) createDiagnostic(c echo.Context) error {
	var body diagnosticDTO
	if err := c.Bind(&body); err != nil {
		return err
	}
	result, err := h.svc.CreateDiagnostic(c.Request().Context(), actor(c).ID, body.InternshipID, body.Kind)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusCreated, result)
}
func (h *handler) completeDiagnostic(c echo.Context) error {
	var body diagnosticCompleteDTO
	if err := c.Bind(&body); err != nil {
		return err
	}
	result, err := h.svc.CompleteDiagnostic(c.Request().Context(), actor(c).ID, c.Param("id"), body.Completed, body.Results)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, result)
}
func (h *handler) development(c echo.Context) error {
	result, err := h.svc.Development(c.Request().Context(), actor(c).ID)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, result)
}
func (h *handler) createGoal(c echo.Context) error {
	var body goalDTO
	if err := c.Bind(&body); err != nil {
		return err
	}
	result, err := h.svc.CreateGoal(c.Request().Context(), actor(c).ID, body.input())
	if err != nil {
		return err
	}
	return c.JSON(http.StatusCreated, result)
}
func (h *handler) patchGoal(c echo.Context) error {
	var body goalPatchDTO
	if err := c.Bind(&body); err != nil {
		return err
	}
	result, err := h.svc.UpdateGoal(c.Request().Context(), actor(c).ID, c.Param("id"), usecase.GoalPatch{Title: body.Title, Description: body.Description, Status: body.Status, Result: body.Result, Progress: body.Progress, DueAt: body.DueAt})
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, result)
}
