package httptransport

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/rs/zerolog"
	"github.com/xuri/excelize/v2"
	"mgts/backend/internal/modules/core/usecase"
	"mgts/backend/internal/storage/memory"
)

const surveyFilesPath = "/api/v1/surveys/responses"

func fileRequest(e *echo.Echo, method, path, actorID string, body []byte) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, surveyFilesPath+path, bytes.NewReader(body))
	if actorID != "" {
		req.Header.Set("X-Actor-ID", actorID)
	}
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return rec
}

func expectImport(t *testing.T, rec *httptest.ResponseRecorder, imported, skipped int) {
	t.Helper()
	var got usecase.SurveyImportResult
	if rec.Code != http.StatusOK || json.Unmarshal(rec.Body.Bytes(), &got) != nil || got.Imported != imported || got.Skipped != skipped {
		t.Fatalf("got %d %s, want imported=%d skipped=%d", rec.Code, rec.Body.String(), imported, skipped)
	}
}

func TestSurveyFilesRoleAndRoundTrip(t *testing.T) {
	e, _ := testAPI()
	for _, actor := range []string{"", "actor-manager", "Н-001", "СТ-001"} {
		want := http.StatusForbidden
		if actor == "" {
			want = http.StatusUnauthorized
		}
		for path, method := range map[string]string{"/export?format=xlsx": http.MethodGet, "/import?format=xlsx": http.MethodPost} {
			if response := fileRequest(e, method, path, actor, nil); response.Code != want {
				t.Fatalf("actor=%q path=%s status=%d, want %d", actor, path, response.Code, want)
			}
		}
	}
	xlsx := fileRequest(e, http.MethodGet, "/export?format=xlsx", "actor-hr", nil)
	if xlsx.Code != http.StatusOK || xlsx.Header().Get("Content-Type") != xlsxContentType {
		t.Fatalf("XLSX export status=%d", xlsx.Code)
	}
	workbook, err := excelize.OpenReader(bytes.NewReader(xlsx.Body.Bytes()))
	if err != nil {
		t.Fatal(err)
	}
	defer workbook.Close()
	for _, name := range workbook.GetSheetList() {
		if dimension, err := workbook.GetSheetDimension(name); err != nil || dimension != "A1:L31" {
			t.Fatalf("sheet %s has dimension %s rather than A1:L31: %v", name, dimension, err)
		}
	}
	tables, err := readSurveyWorkbook(xlsx.Body.Bytes())
	if err != nil || len(tables) != 2 || len(tables[0].Rows) != 31 || len(tables[1].Rows) != 31 {
		t.Fatalf("expected two sheets with 30 responses each: %v", err)
	}
	expectImport(t, fileRequest(e, http.MethodPost, "/import?format=xlsx", "actor-hr", xlsx.Body.Bytes()), 0, 60)
	for _, audience := range []string{"intern", "mentor"} {
		csv := fileRequest(e, http.MethodGet, "/export?format=csv&audience="+audience, "actor-hr", nil)
		if csv.Code != http.StatusOK || !bytes.HasPrefix(csv.Body.Bytes(), []byte("\ufeff")) {
			t.Fatalf("CSV export %s status=%d", audience, csv.Code)
		}
		expectImport(t, fileRequest(e, http.MethodPost, "/import?format=csv", "actor-hr", csv.Body.Bytes()), 0, 30)
	}
}

func TestSurveyImportValidatesWholeFileBeforeSaving(t *testing.T) {
	ctx := context.Background()
	state := memory.Seed()
	service := usecase.New(memory.New(state))
	tables, err := service.ExportSurveyResponses(ctx, "actor-hr")
	if err != nil {
		t.Fatal(err)
	}
	for index := range tables {
		tables[index].Rows = tables[index].Rows[:2]
	}
	for _, id := range []string{"response-intern-01-1", "response-mentor-01-1"} {
		assignment := state.Assignments[state.Responses[id].AssignmentID]
		assignment.Status, assignment.SubmittedAt = "assigned", nil
		state.Assignments[assignment.ID] = assignment
		delete(state.Responses, id)
		for key, metric := range state.Metrics {
			if metric.ResponseID == id {
				delete(state.Metrics, key)
			}
		}
	}
	store := memory.New(state)
	e := NewServer(usecase.New(store), zerolog.Nop(), "test", 8080).Echo()
	post := func() *httptest.ResponseRecorder {
		t.Helper()
		file, err := writeSurveyWorkbook(tables)
		if err != nil {
			t.Fatal(err)
		}
		return fileRequest(e, http.MethodPost, "/import?format=xlsx", "actor-hr", file)
	}
	validScore := tables[1].Rows[1][4]
	tables[1].Rows[1][4] = 8
	invalid := post()
	if invalid.Code != http.StatusBadRequest || !strings.Contains(invalid.Body.String(), "строка 2") {
		t.Fatalf("invalid row status=%d, body=%s", invalid.Code, invalid.Body.String())
	}
	snapshot, err := store.Snapshot(ctx)
	if err != nil || len(snapshot.Responses) != 58 {
		t.Fatalf("invalid workbook must leave both answers absent: %v", err)
	}
	tables[1].Rows[1][4] = validScore
	expectImport(t, post(), 2, 0)
	expectImport(t, post(), 0, 2)
	snapshot, err = store.Snapshot(ctx)
	if err != nil || len(snapshot.Responses) != 60 || len(snapshot.Metrics) != 390 || snapshot.SurveyCoverage("survey-mentor-1").Submitted != 5 {
		t.Fatalf("expected submitted responses, recalculated metrics and full coverage: %v", err)
	}
	tables[1].Rows[1][4] = 1
	conflict := post()
	if conflict.Code != http.StatusBadRequest || !strings.Contains(conflict.Body.String(), "уже сохранён с другими значениями") {
		t.Fatalf("conflict status=%d, body=%s", conflict.Code, conflict.Body.String())
	}
}

func TestSurveyCSVPreservesTextAndProtectsExcelCells(t *testing.T) {
	comment := " =текст; с разделителем\nи переносом"
	file, err := writeSurveyCSV([][]any{{"Поле", "Оценка"}, {comment, 4}})
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Contains(file, []byte("' =текст")) {
		t.Fatal("formula-like comment must be prefixed in export")
	}
	table, err := readSurveyCSV(file)
	if err != nil || table.Rows[1][0] != comment || table.Rows[1][1] != "4" {
		t.Fatalf("CSV did not round trip: %v", err)
	}
}
