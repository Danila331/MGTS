package httptransport

import (
	"crypto/rsa"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
	"mgts/backend/internal/modules/core/domain"
)

const secureActorKey = "mgts_verified_actor"

type JWTAuth struct {
	PublicKey *rsa.PublicKey
	Issuer    string
	Audience  string
	Origin    string
}

func (a JWTAuth) subject(c echo.Context) (string, error) {
	request := c.Request()
	if request.Method != http.MethodGet && request.Method != http.MethodHead && request.Header.Get("Origin") != a.Origin {
		return "", domain.ErrForbidden
	}
	raw, ok := strings.CutPrefix(request.Header.Get("Authorization"), "Bearer ")
	if !ok || raw == "" {
		return "", domain.ErrUnauthorized
	}
	claims := &jwt.RegisteredClaims{}
	token, err := jwt.ParseWithClaims(raw, claims, func(_ *jwt.Token) (any, error) { return a.PublicKey, nil },
		jwt.WithValidMethods([]string{"RS256"}), jwt.WithIssuer(a.Issuer), jwt.WithAudience(a.Audience),
		jwt.WithExpirationRequired())
	if err != nil || !token.Valid || strings.TrimSpace(claims.Subject) == "" {
		return "", domain.ErrUnauthorized
	}
	return claims.Subject, nil
}
