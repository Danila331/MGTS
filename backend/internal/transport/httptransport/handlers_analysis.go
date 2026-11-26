package httptransport

import (
	"net/http"

	"github.com/labstack/echo/v4"
)

func (h *handler) retrySurveyAnalysis(c echo.Context) error {
	if err := requireExplicitHR(c); err != nil {
		return err
	}
	if err := h.svc.RetrySurveyAnalysis(c.Request().Context(), actor(c).ID, c.Param("id")); err != nil {
		return err
	}
	return c.JSON(http.StatusAccepted, map[string]string{"status": "pending"})
}
