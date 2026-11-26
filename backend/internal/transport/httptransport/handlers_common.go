package httptransport

import (
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
	"mgts/backend/internal/modules/core/usecase"
)

type handler struct{ svc *usecase.Service }

func (h *handler) actors(c echo.Context) error {
	items, err := h.svc.Actors(c.Request().Context())
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, map[string]any{"items": items})
}
func (h *handler) bootstrap(c echo.Context) error {
	result, err := h.svc.Bootstrap(c.Request().Context(), actor(c).ID)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, result)
}
func (h *handler) me(c echo.Context) error {
	result, err := h.svc.Me(c.Request().Context(), actor(c).ID)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, result)
}
func (h *handler) dashboard(c echo.Context) error {
	result, err := h.svc.Dashboard(c.Request().Context(), actor(c).ID)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, result)
}
func (h *handler) mentorOverview(c echo.Context) error {
	if err := requireExplicitHR(c); err != nil {
		return err
	}
	result, err := h.svc.MentorOverview(c.Request().Context(), actor(c).ID)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, result)
}
func (h *handler) interns(c echo.Context) error {
	page, _ := strconv.Atoi(c.QueryParam("page"))
	result, err := h.svc.Interns(c.Request().Context(), actor(c).ID, usecase.InternFilters{
		Search: c.QueryParam("search"), TeamID: c.QueryParam("team_id"), CohortID: c.QueryParam("cohort_id"),
		Signal: c.QueryParam("signal"), Department: c.QueryParam("department"), Sort: c.QueryParam("sort"), Page: page,
	})
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, result)
}
func (h *handler) internOptions(c echo.Context) error {
	if err := requireExplicitHR(c); err != nil {
		return err
	}
	result, err := h.svc.InternOptions(c.Request().Context(), actor(c).ID)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, result)
}

func (h *handler) createIntern(c echo.Context) error {
	if err := requireExplicitHR(c); err != nil {
		return err
	}
	var input usecase.NewIntern
	if err := c.Bind(&input); err != nil {
		return err
	}
	result, err := h.svc.CreateIntern(c.Request().Context(), actor(c).ID, input)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusCreated, result)
}

func (h *handler) internship(c echo.Context) error {
	result, err := h.svc.Internship(c.Request().Context(), actor(c).ID, c.Param("id"))
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, result)
}
func (h *handler) patchInternship(c echo.Context) error {
	var body internshipPatchDTO
	if err := c.Bind(&body); err != nil {
		return err
	}
	result, err := h.svc.UpdateInternship(c.Request().Context(), actor(c).ID, c.Param("id"), usecase.InternshipPatch{Stage: body.Stage, Progress: body.Progress, Settings: body.Settings})
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, result)
}
