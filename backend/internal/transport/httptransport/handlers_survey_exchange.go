package httptransport

import (
	"bytes"
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/labstack/echo/v4"
	"github.com/xuri/excelize/v2"
	"golang.org/x/text/encoding/charmap"
	"mgts/backend/internal/modules/core/domain"
	"mgts/backend/internal/modules/core/usecase"
)

const (
	xlsxContentType  = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
	csvContentType   = "text/csv; charset=utf-8"
	maxImportRows    = 10000
	maxImportColumns = 64
)

func requireExplicitHR(c echo.Context) error {
	if c.Get(secureActorKey) != true && c.Request().Header.Get("X-Actor-ID") == "" && c.QueryParam("actor_id") == "" {
		return domain.ErrUnauthorized
	}
	if actor(c).Role != domain.RoleHR {
		return domain.ErrForbidden
	}
	return nil
}

func (h *handler) exportSurveyResponses(c echo.Context) error {
	if err := requireExplicitHR(c); err != nil {
		return err
	}
	format := c.QueryParam("format")
	audience := domain.Role(c.QueryParam("audience"))
	if format != "xlsx" && format != "csv" {
		return spreadsheetValidation("Выберите формат XLSX или CSV")
	}
	if format == "csv" && audience != domain.RoleIntern && audience != domain.RoleMentor {
		return spreadsheetValidation("Для CSV выберите форму стажёров или наставников")
	}
	tables, err := h.svc.ExportSurveyResponses(c.Request().Context(), actor(c).ID)
	if err != nil {
		return err
	}
	if format == "xlsx" {
		content, err := writeSurveyWorkbook(tables)
		if err != nil {
			return err
		}
		return surveyAttachment(c, "pulse-responses.xlsx", xlsxContentType, content)
	}
	for _, table := range tables {
		if table.Role == audience {
			content, err := writeSurveyCSV(table.Rows)
			if err != nil {
				return err
			}
			return surveyAttachment(c, "pulse-"+string(audience)+"-responses.csv", csvContentType, content)
		}
	}
	return domain.ErrNotFound
}

func surveyAttachment(c echo.Context, name, kind string, content []byte) error {
	c.Response().Header().Set("Content-Disposition", "attachment; filename="+name)
	c.Response().Header().Set("Cache-Control", "no-store")
	return c.Blob(http.StatusOK, kind, content)
}

func (h *handler) importSurveyResponses(c echo.Context) error {
	if err := requireExplicitHR(c); err != nil {
		return err
	}
	format := c.QueryParam("format")
	if format != "xlsx" && format != "csv" {
		return spreadsheetValidation("Выберите файл XLSX или CSV")
	}
	content, err := io.ReadAll(c.Request().Body)
	if err != nil {
		return err
	}
	var tables []usecase.SurveyImportTable
	if format == "xlsx" {
		tables, err = readSurveyWorkbook(content)
	} else {
		var table usecase.SurveyImportTable
		table, err = readSurveyCSV(content)
		tables = []usecase.SurveyImportTable{table}
	}
	if err != nil {
		return err
	}
	result, err := h.svc.ImportSurveyResponses(c.Request().Context(), actor(c).ID, tables)
	if err != nil {
		return err
	}
	return c.JSON(http.StatusOK, result)
}

func writeSurveyWorkbook(tables []usecase.SurveyExportTable) ([]byte, error) {
	file := excelize.NewFile()
	defer file.Close()
	headerStyle, err := file.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true},
		Alignment: &excelize.Alignment{Vertical: "center", WrapText: true},
		Fill:      excelize.Fill{Type: "pattern", Pattern: 1, Color: []string{"#F2F2F4"}},
	})
	if err != nil {
		return nil, err
	}
	for i, table := range tables {
		if i == 0 {
			if err := file.SetSheetName("Sheet1", table.Name); err != nil {
				return nil, err
			}
		} else if _, err := file.NewSheet(table.Name); err != nil {
			return nil, err
		}
		for index, row := range table.Rows {
			if err := file.SetSheetRow(table.Name, fmt.Sprintf("A%d", index+1), &row); err != nil {
				return nil, err
			}
		}
		if err := file.SetSheetDimension(table.Name, fmt.Sprintf("A1:L%d", len(table.Rows))); err != nil {
			return nil, err
		}
		if err := file.SetCellStyle(table.Name, "A1", "L1", headerStyle); err != nil {
			return nil, err
		}
		if err := file.SetRowHeight(table.Name, 1, 34); err != nil {
			return nil, err
		}
		if err := file.SetColWidth(table.Name, "A", "J", 23); err != nil {
			return nil, err
		}
		if err := file.SetColWidth(table.Name, "K", "L", 52); err != nil {
			return nil, err
		}
	}
	buffer, err := file.WriteToBuffer()
	if err != nil {
		return nil, err
	}
	return buffer.Bytes(), nil
}

func readSurveyWorkbook(content []byte) ([]usecase.SurveyImportTable, error) {
	file, err := excelize.OpenReader(bytes.NewReader(content), excelize.Options{
		RawCellValue: true, UnzipSizeLimit: 32 << 20, UnzipXMLSizeLimit: 8 << 20,
	})
	if err != nil {
		return nil, spreadsheetValidation("Не удалось прочитать файл XLSX")
	}
	defer file.Close()
	var tables []usecase.SurveyImportTable
	remaining := maxImportRows
	for _, name := range file.GetSheetList() {
		rows, err := file.Rows(name)
		if err != nil {
			return nil, spreadsheetValidation(fmt.Sprintf("Не удалось прочитать лист «%s»", name))
		}
		table, err := readSurveySheet(rows, name, &remaining)
		if err != nil {
			return nil, err
		}
		tables = append(tables, table)
	}
	return tables, nil
}

func readSurveySheet(rows *excelize.Rows, name string, remaining *int) (usecase.SurveyImportTable, error) {
	defer rows.Close()
	table := usecase.SurveyImportTable{Name: name}
	for rows.Next() {
		if *remaining == 0 {
			return table, spreadsheetValidation("В файле больше 10 000 строк")
		}
		*remaining = *remaining - 1
		row, err := rows.Columns(excelize.Options{RawCellValue: true})
		if err != nil {
			return table, spreadsheetValidation(fmt.Sprintf("Не удалось прочитать лист «%s», строка %d", name, len(table.Rows)+1))
		}
		if len(row) > maxImportColumns {
			return table, spreadsheetValidation(fmt.Sprintf("Лист «%s», строка %d: слишком много колонок", name, len(table.Rows)+1))
		}
		table.Rows = append(table.Rows, row)
	}
	if err := rows.Error(); err != nil {
		return table, spreadsheetValidation(fmt.Sprintf("Не удалось прочитать лист «%s»", name))
	}
	return table, nil
}

func writeSurveyCSV(rows [][]any) ([]byte, error) {
	var buffer bytes.Buffer
	buffer.WriteString("\ufeff")
	writer := csv.NewWriter(&buffer)
	writer.Comma = ';'
	for _, row := range rows {
		record := make([]string, len(row))
		for index, value := range row {
			switch value := value.(type) {
			case nil:
			case string:
				record[index] = value
				if csvNeedsTextPrefix(value) || strings.HasPrefix(value, "'") {
					record[index] = "'" + value
				}
			default:
				record[index] = fmt.Sprint(value)
			}
		}
		if err := writer.Write(record); err != nil {
			return nil, err
		}
	}
	writer.Flush()
	return buffer.Bytes(), writer.Error()
}

func readSurveyCSV(content []byte) (usecase.SurveyImportTable, error) {
	content = bytes.TrimPrefix(content, []byte("\ufeff"))
	if !utf8.Valid(content) {
		decoded, err := charmap.Windows1251.NewDecoder().Bytes(content)
		if err != nil {
			return usecase.SurveyImportTable{}, spreadsheetValidation("Сохраните CSV в UTF-8 или Windows-1251")
		}
		content = decoded
	}
	reader := csv.NewReader(bytes.NewReader(content))
	reader.Comma = surveyCSVSeparator(content)
	reader.FieldsPerRecord = -1
	table := usecase.SurveyImportTable{Name: "CSV"}
	for {
		row, err := reader.Read()
		if errors.Is(err, io.EOF) {
			return table, nil
		}
		if err != nil {
			var parseErr *csv.ParseError
			if errors.As(err, &parseErr) {
				return table, spreadsheetValidation(fmt.Sprintf("Некорректный CSV в строке %d", parseErr.Line))
			}
			return table, spreadsheetValidation("Не удалось прочитать CSV")
		}
		if len(table.Rows) >= maxImportRows {
			return table, spreadsheetValidation("В файле больше 10 000 строк")
		}
		if len(row) > maxImportColumns {
			return table, spreadsheetValidation(fmt.Sprintf("CSV, строка %d: слишком много колонок", len(table.Rows)+1))
		}
		for index, value := range row {
			if rest, prefixed := strings.CutPrefix(value, "'"); prefixed && (csvNeedsTextPrefix(rest) || strings.HasPrefix(rest, "'")) {
				row[index] = rest
			}
		}
		table.Rows = append(table.Rows, row)
	}
}

func surveyCSVSeparator(content []byte) rune {
	separator, count := ';', 0
	for _, candidate := range []rune{';', ','} {
		reader := csv.NewReader(bytes.NewReader(content))
		reader.Comma = candidate
		if row, err := reader.Read(); err == nil && len(row) > count {
			separator, count = candidate, len(row)
		}
	}
	return separator
}

func csvNeedsTextPrefix(value string) bool {
	trimmed := strings.TrimLeftFunc(value, unicode.IsSpace)
	first, _ := utf8.DecodeRuneInString(trimmed)
	return strings.HasPrefix(value, "\t") || strings.HasPrefix(value, "\r") || strings.HasPrefix(value, "\n") ||
		strings.ContainsRune("=+-@＝＋－＠", first)
}

func spreadsheetValidation(message string) error {
	return fmt.Errorf("%w: %s", domain.ErrValidation, message)
}
