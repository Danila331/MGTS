package huntflow

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"mgts/backend/internal/modules/core/domain"
	"mgts/backend/internal/modules/core/usecase"
)

const recentLogLimit = 10

type Client struct {
	Token     string
	AccountID int
	WebURL    string
	Transport http.RoundTripper
}

type vacancyLink struct {
	VacancyID int       `json:"vacancy"`
	Updated   time.Time `json:"updated"`
}

func (c Client) ReadCandidate(ctx context.Context, id int) (usecase.CandidateProfile, error) {
	if id < 1 {
		return usecase.CandidateProfile{}, domain.ErrValidation
	}
	ctx, cancel := context.WithTimeout(ctx, 8*time.Second)
	defer cancel()

	path := fmt.Sprintf("/accounts/%d/applicants/%d", c.AccountID, id)
	var candidate struct {
		ID        int           `json:"id"`
		AccountID int           `json:"account"`
		Position  string        `json:"position"`
		Links     []vacancyLink `json:"links"`
	}
	if err := c.read(ctx, path, &candidate); err != nil {
		return usecase.CandidateProfile{}, err
	}
	if candidate.ID != id || candidate.AccountID != c.AccountID {
		return usecase.CandidateProfile{}, fmt.Errorf("unexpected Huntflow candidate: %w", domain.ErrUnavailable)
	}
	var logs struct {
		Items []struct {
			Comment string `json:"comment"`
		} `json:"items"`
	}
	if err := c.read(ctx, fmt.Sprintf("%s/logs?count=%d&page=1", path, recentLogLimit), &logs); err != nil {
		if errors.Is(err, domain.ErrNotFound) {
			return usecase.CandidateProfile{}, fmt.Errorf("Huntflow candidate logs unavailable: %w", domain.ErrUnavailable)
		}
		return usecase.CandidateProfile{}, err
	}
	if logs.Items == nil {
		return usecase.CandidateProfile{}, fmt.Errorf("Huntflow candidate logs missing: %w", domain.ErrUnavailable)
	}
	result := usecase.CandidateProfile{ID: id, Position: strings.TrimSpace(candidate.Position), URL: c.candidateURL(id, candidate.Links)}
	for _, entry := range logs.Items[:min(len(logs.Items), recentLogLimit)] {
		if strings.TrimSpace(entry.Comment) != "" {
			result.Feedback++
		}
	}
	return result, nil
}

func (c Client) candidateURL(id int, links []vacancyLink) string {
	var latest vacancyLink
	for _, link := range links {
		if link.VacancyID > 0 && (latest.VacancyID == 0 || link.Updated.After(latest.Updated)) {
			latest = link
		}
	}
	if latest.VacancyID == 0 || c.WebURL == "" {
		return ""
	}
	workspace, err := url.Parse(strings.TrimRight(c.WebURL, "/"))
	if err != nil {
		return ""
	}
	// Huntflow's workspace route opens the candidate within a vacancy.
	workspace.Fragment = fmt.Sprintf("vacancy/%d/filter/workon/id/%d", latest.VacancyID, id)
	return workspace.String()
}

func (c Client) read(ctx context.Context, path string, target any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://api.huntflow.ru/v2"+path, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.Token)
	req.Header.Set("Accept", "application/json")
	client := http.Client{
		Transport:     c.Transport,
		CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
	}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("Huntflow недоступен: %w", domain.ErrUnavailable)
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return domain.ErrNotFound
	}
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("Huntflow HTTP %d: %w", resp.StatusCode, domain.ErrUnavailable)
	}
	const maxResponseBytes = 1 << 20
	data, err := io.ReadAll(io.LimitReader(resp.Body, maxResponseBytes+1))
	if err != nil || len(data) > maxResponseBytes || json.Unmarshal(data, target) != nil {
		return fmt.Errorf("не удалось прочитать ответ Huntflow: %w", domain.ErrUnavailable)
	}
	return nil
}
