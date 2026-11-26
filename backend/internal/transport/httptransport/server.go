package httptransport

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/rs/zerolog"
	"mgts/backend/internal/modules/core/domain"
	"mgts/backend/internal/modules/core/usecase"
)

const actorKey = "mgts_actor"

type Server struct {
	echo    *echo.Echo
	service *usecase.Service
	logger  zerolog.Logger
	version string
	port    int
}

func NewServer(service *usecase.Service, logger zerolog.Logger, version string, port int) *Server {
	e := echo.New()
	e.HideBanner = true
	e.HidePort = true
	e.Server.ReadHeaderTimeout = 10 * time.Second
	e.Server.ReadTimeout = 30 * time.Second
	e.Server.WriteTimeout = 60 * time.Second
	e.Server.IdleTimeout = 120 * time.Second
	e.Use(middleware.RequestID(), middleware.Recover(), middleware.BodyLimit("2M"), middleware.CORSWithConfig(middleware.CORSConfig{AllowOrigins: []string{"*"}, AllowMethods: []string{http.MethodGet, http.MethodPost, http.MethodPatch, http.MethodPut, http.MethodDelete, http.MethodOptions}, AllowHeaders: []string{echo.HeaderContentType, "X-Actor-ID"}}))
	server := &Server{echo: e, service: service, logger: logger, version: version, port: port}
	e.HTTPErrorHandler = server.errorHandler
	e.Use(requestLogger(logger))
	e.GET("/health", server.health)
	api := e.Group("/api/v1")
	api.GET("/health", server.health)
	h := &handler{svc: service}
	// External callbacks authenticate at the integration boundary in production; demo idempotency is always enforced.
	api.POST("/integrations/surveys/webhook", h.importSurvey)
	api.Use(server.actorMiddleware)
	api.GET("/actors", h.actors)
	api.GET("/bootstrap", h.bootstrap)
	api.GET("/me", h.me)
	api.GET("/dashboard", h.dashboard)
	api.GET("/dashboard/mentors", h.mentorOverview)
	api.GET("/interns", h.interns)
	api.POST("/interns", h.createIntern)
	api.GET("/interns/options", h.internOptions)
	api.GET("/interns/:id", h.internship)
	api.PATCH("/internships/:id", h.patchInternship)
	api.GET("/surveys", h.surveys)
	api.POST("/surveys", h.createSurvey)
	api.GET("/surveys/responses/export", h.exportSurveyResponses)
	api.POST("/surveys/responses/import", h.importSurveyResponses)
	api.GET("/surveys/:id", h.survey)
	api.PATCH("/surveys/:id", h.patchSurvey)
	api.DELETE("/surveys/:id", h.deleteSurvey)
	api.POST("/surveys/:id/publish", h.publishSurvey)
	api.POST("/surveys/:id/assign", h.assignSurvey)
	api.GET("/surveys/:id/take", h.takeSurvey)
	api.PUT("/surveys/:id/draft", h.saveDraft)
	api.POST("/surveys/:id/submit", h.submitSurvey)
	api.GET("/feedback", h.feedback)
	api.POST("/feedback", h.createFeedback)
	api.PATCH("/feedback/:id", h.patchFeedback)
	api.POST("/feedback/:id/publish", h.publishFeedback)
	api.POST("/feedback/requests", h.requestFeedback)
	api.POST("/feedback/:id/ai-summary", h.feedbackSummary)
	api.GET("/signals", h.signals)
	api.GET("/signals/:id", h.signal)
	api.PATCH("/signals/:id", h.patchSignal)
	api.POST("/signals/:id/actions", h.createAction)
	api.PATCH("/actions/:id", h.patchAction)
	api.GET("/reviews", h.reviews)
	api.POST("/reviews", h.createReview)
	api.GET("/reviews/:id", h.review)
	api.PATCH("/reviews/:id", h.patchReview)
	api.POST("/reviews/:id/analyze", h.analyzeReview)
	api.POST("/reviews/:id/calibrate", h.calibrateReview)
	api.POST("/reviews/:id/announce", h.announceReview)
	api.GET("/diagnostics", h.diagnostics)
	api.POST("/diagnostics", h.createDiagnostic)
	api.POST("/diagnostics/:id/complete", h.completeDiagnostic)
	api.GET("/development", h.development)
	api.POST("/development/goals", h.createGoal)
	api.PATCH("/development/goals/:id", h.patchGoal)
	api.POST("/ai/query", h.aiQuery)
	api.POST("/ai/analyze", h.aiAnalyze)
	api.POST("/ai/edit", h.aiEdit)
	api.GET("/integrations", h.integrations)
	api.POST("/integrations/:id/sync", h.syncIntegration)
	api.GET("/settings", h.settings)
	api.PATCH("/settings", h.patchSettings)
	return server
}

func (s *Server) Start() error                       { return s.echo.Start(fmt.Sprintf(":%d", s.port)) }
func (s *Server) Shutdown(ctx context.Context) error { return s.echo.Shutdown(ctx) }
func (s *Server) Echo() *echo.Echo                   { return s.echo }
func (s *Server) health(c echo.Context) error {
	return c.JSON(http.StatusOK, map[string]string{"status": "ok", "version": s.version, "storage": s.service.Storage()})
}

func (s *Server) actorMiddleware(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		actorID := c.Request().Header.Get("X-Actor-ID")
		if actorID == "" {
			actorID = c.QueryParam("actor_id")
		}
		if actorID == "" {
			actorID = usecase.DefaultActorID
		}
		actors, err := s.service.Actors(c.Request().Context())
		if err != nil {
			return err
		}
		for _, actor := range actors {
			if actor.ID == actorID {
				c.Set(actorKey, actor)
				return next(c)
			}
		}
		return writeError(c, http.StatusUnauthorized, "unauthorized", "unknown demo actor")
	}
}
func actor(c echo.Context) domain.Actor { return c.Get(actorKey).(domain.Actor) }

func (s *Server) errorHandler(err error, c echo.Context) {
	if c.Response().Committed {
		return
	}
	status, code, message := mapError(err)
	var httpError *echo.HTTPError
	if errors.As(err, &httpError) {
		status = httpError.Code
		code = "bad_request"
		message = fmt.Sprint(httpError.Message)
		if status == http.StatusNotFound {
			code = "not_found"
			message = "route not found"
		}
	}
	if status >= 500 {
		s.logger.Error().Err(err).Str("path", c.Request().URL.Path).Msg("request failed")
		message = "internal server error"
	}
	_ = writeError(c, status, code, message)
}
func mapError(err error) (int, string, string) {
	switch {
	case errors.Is(err, domain.ErrValidation):
		return 400, "validation_error", err.Error()
	case errors.Is(err, domain.ErrUnauthorized):
		return 401, "unauthorized", "actor is not authorized"
	case errors.Is(err, domain.ErrForbidden):
		return 403, "forbidden", "access denied"
	case errors.Is(err, domain.ErrNotFound):
		return 404, "not_found", "entity not found"
	case errors.Is(err, domain.ErrConflict), errors.Is(err, domain.ErrAlreadyExists):
		return 409, "conflict", err.Error()
	default:
		return 500, "internal_error", "internal server error"
	}
}
func writeError(c echo.Context, status int, code, message string) error {
	return c.JSON(status, map[string]any{"error": map[string]string{"code": code, "message": message}})
}
func requestLogger(logger zerolog.Logger) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			start := time.Now()
			err := next(c)
			logger.Info().Err(err).Str("method", c.Request().Method).Str("path", c.Request().URL.Path).Int("status", c.Response().Status).Dur("duration", time.Since(start)).Msg("http request")
			return err
		}
	}
}
