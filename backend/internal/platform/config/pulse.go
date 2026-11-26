package config

import (
	"crypto/rsa"
	"fmt"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

type Pulse struct {
	Production      bool
	Bootstrap       string
	AuthKey         *rsa.PublicKey
	AuthIssuer      string
	AuthAudience    string
	Origin          string
	AIEndpoint      string
	AIToken         string
	AIModel         string
	TallySecret     string
	InviteKey       string
	TallyIntern     string
	TallyMentor     string
	HuntflowToken   string
	HuntflowAccount int
	HuntflowWebURL  string
}

func loadPulse(storage string) (Pulse, error) {
	p := Pulse{
		Bootstrap:  os.Getenv("PULSE_BOOTSTRAP_FILE"),
		AuthIssuer: os.Getenv("PULSE_AUTH_ISSUER"), AuthAudience: os.Getenv("PULSE_AUTH_AUDIENCE"),
		Origin:     strings.TrimRight(os.Getenv("PULSE_PUBLIC_ORIGIN"), "/"),
		AIEndpoint: os.Getenv("PULSE_AI_ENDPOINT"), AIToken: os.Getenv("PULSE_AI_TOKEN"), AIModel: os.Getenv("PULSE_AI_MODEL"),
		TallySecret: os.Getenv("PULSE_TALLY_SECRET"), InviteKey: os.Getenv("PULSE_INVITE_KEY"),
		TallyIntern: os.Getenv("PULSE_TALLY_INTERN_FORM"), TallyMentor: os.Getenv("PULSE_TALLY_MENTOR_FORM"),
		HuntflowToken: os.Getenv("PULSE_HUNTFLOW_TOKEN"), HuntflowWebURL: os.Getenv("PULSE_HUNTFLOW_WEB_URL"),
	}
	switch os.Getenv("PULSE_MODE") {
	case "", "demo":
	case "production":
		p.Production = true
		if storage != "postgres" || os.Getenv("DATABASE_URL") == "" || p.AuthAudience == "" || !validURL(p.AuthIssuer, false) || !validOrigin(p.Origin) {
			return Pulse{}, fmt.Errorf("production requires postgres, DATABASE_URL, PULSE_AUTH_ISSUER, PULSE_AUTH_AUDIENCE and PULSE_PUBLIC_ORIGIN")
		}
		key, err := jwt.ParseRSAPublicKeyFromPEM([]byte(os.Getenv("PULSE_AUTH_PUBLIC_KEY")))
		if err != nil || key.N.BitLen() < 2048 {
			return Pulse{}, fmt.Errorf("PULSE_AUTH_PUBLIC_KEY must be a PEM RSA public key of at least 2048 bits")
		}
		p.AuthKey = key
	default:
		return Pulse{}, fmt.Errorf("PULSE_MODE must be demo or production")
	}
	if p.AIEndpoint != "" || p.AIModel != "" || p.AIToken != "" {
		if !validURL(p.AIEndpoint, true) || p.AIModel == "" {
			return Pulse{}, fmt.Errorf("AI requires PULSE_AI_ENDPOINT and PULSE_AI_MODEL")
		}
	}
	if p.TallySecret != "" || p.InviteKey != "" || p.TallyIntern != "" || p.TallyMentor != "" {
		formID := regexp.MustCompile(`^[A-Za-z0-9_-]{1,80}$`)
		if len(p.TallySecret) < 24 || len(p.InviteKey) < 32 || p.TallySecret == p.InviteKey ||
			!formID.MatchString(p.TallyIntern) || !formID.MatchString(p.TallyMentor) || p.TallyIntern == p.TallyMentor {
			return Pulse{}, fmt.Errorf("Tally requires two distinct form IDs and independent PULSE_TALLY_SECRET and PULSE_INVITE_KEY")
		}
	}
	if raw := os.Getenv("PULSE_HUNTFLOW_ACCOUNT"); raw != "" {
		p.HuntflowAccount, _ = strconv.Atoi(raw)
	}
	if p.HuntflowToken != "" || p.HuntflowAccount != 0 || p.HuntflowWebURL != "" {
		if p.HuntflowToken == "" || p.HuntflowAccount < 1 || (p.HuntflowWebURL != "" && !validURL(p.HuntflowWebURL, false)) {
			return Pulse{}, fmt.Errorf("Huntflow requires PULSE_HUNTFLOW_TOKEN and PULSE_HUNTFLOW_ACCOUNT")
		}
		if p.HuntflowWebURL != "" {
			parsed, _ := url.Parse(p.HuntflowWebURL)
			if host := parsed.Hostname(); host != "huntflow.ru" && !strings.HasSuffix(host, ".huntflow.ru") {
				return Pulse{}, fmt.Errorf("PULSE_HUNTFLOW_WEB_URL must be a Huntflow URL")
			}
		}
	}
	return p, nil
}

func validURL(raw string, localHTTP bool) bool {
	u, err := url.Parse(raw)
	if err != nil || u.Host == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" {
		return false
	}
	return u.Scheme == "https" || (localHTTP && u.Scheme == "http" && (u.Hostname() == "localhost" || u.Hostname() == "127.0.0.1" || u.Hostname() == "::1"))
}

func validOrigin(raw string) bool {
	if !validURL(raw, false) {
		return false
	}
	u, _ := url.Parse(raw)
	return u.Path == ""
}
