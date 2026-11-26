package domain

import "time"

type Role string

const (
	RoleHR      Role = "hr"
	RoleManager Role = "manager"
	RoleMentor  Role = "mentor"
	RoleIntern  Role = "intern"
)

type Actor struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Role         Role   `json:"role"`
	TeamID       string `json:"team_id,omitempty"`
	InternshipID string `json:"internship_id,omitempty"`
	Initials     string `json:"initials"`
}

type Team struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type Cohort struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Program   string `json:"program"`
	StartedAt string `json:"started_at"`
	EndsAt    string `json:"ends_at"`
}

type Internship struct {
	ID           string    `json:"id"`
	Intern       Person    `json:"intern"`
	Program      string    `json:"program"`
	CohortID     string    `json:"cohort_id"`
	Cohort       string    `json:"cohort"`
	TeamID       string    `json:"team_id"`
	Team         string    `json:"team"`
	Stage        string    `json:"stage"`
	ManagerID    string    `json:"manager_id"`
	Manager      string    `json:"manager"`
	MentorID     string    `json:"mentor_id"`
	Mentor       string    `json:"mentor"`
	Progress     int       `json:"progress"`
	Settings     Map       `json:"settings,omitempty"`
	LastActivity time.Time `json:"last_activity"`
}

type Person struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Initials string `json:"initials"`
}

type Participant struct {
	ActorID string `json:"actor_id"`
	Name    string `json:"name"`
	Role    Role   `json:"role"`
}

type Question struct {
	ID        string   `json:"id"`
	Type      string   `json:"type"`
	Title     string   `json:"title"`
	Required  bool     `json:"required"`
	Dimension string   `json:"dimension,omitempty"`
	Min       int      `json:"min,omitempty"`
	Max       int      `json:"max,omitempty"`
	Version   int      `json:"version,omitempty"`
	Options   []string `json:"options,omitempty"`
}

type Survey struct {
	ID          string     `json:"id"`
	Title       string     `json:"title"`
	Description string     `json:"description"`
	Status      string     `json:"status"`
	Audience    Role       `json:"audience"`
	Period      string     `json:"period"`
	DueAt       time.Time  `json:"due_at"`
	Wave        int        `json:"wave"`
	Questions   []Question `json:"questions"`
	Coverage    Coverage   `json:"coverage"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

type Assignment struct {
	ID           string     `json:"id"`
	SurveyID     string     `json:"survey_id"`
	InternshipID string     `json:"internship_id"`
	RespondentID string     `json:"respondent_id"`
	Status       string     `json:"status"`
	DueAt        time.Time  `json:"due_at"`
	SubmittedAt  *time.Time `json:"submitted_at,omitempty"`
}

type Response struct {
	ID           string         `json:"id"`
	SurveyID     string         `json:"survey_id"`
	AssignmentID string         `json:"assignment_id"`
	InternshipID string         `json:"internship_id"`
	RespondentID string         `json:"respondent_id"`
	Respondent   string         `json:"respondent"`
	Role         Role           `json:"role"`
	Wave         int            `json:"wave"`
	Answers      map[string]any `json:"answers"`
	Status       string         `json:"status"`
	ExternalID   string         `json:"external_id,omitempty"`
	Version      int            `json:"version"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
}

type Coverage struct {
	Invited   int     `json:"invited"`
	Submitted int     `json:"submitted"`
	Unique    int     `json:"unique"`
	Percent   float64 `json:"percent"`
}

type MetricPoint struct {
	ID              string    `json:"id"`
	ResponseID      string    `json:"response_id"`
	InternshipID    string    `json:"internship_id"`
	SurveyID        string    `json:"survey_id"`
	QuestionID      string    `json:"question_id,omitempty"`
	QuestionVersion int       `json:"question_version,omitempty"`
	ScaleMin        int       `json:"scale_min,omitempty"`
	ScaleMax        int       `json:"scale_max,omitempty"`
	ScaleSignature  string    `json:"scale_signature,omitempty"`
	Dimension       string    `json:"dimension"`
	Value           float64   `json:"value"`
	Role            Role      `json:"role"`
	Wave            int       `json:"wave"`
	CreatedAt       time.Time `json:"created_at"`
}

type Evidence struct {
	ID           string  `json:"id"`
	Type         string  `json:"type"`
	SourceID     string  `json:"source_id"`
	Quote        string  `json:"quote,omitempty"`
	Value        float64 `json:"value,omitempty"`
	InternshipID string  `json:"internship_id,omitempty"`
}

type Action struct {
	ID          string     `json:"id"`
	SignalID    string     `json:"signal_id"`
	Title       string     `json:"title"`
	OwnerID     string     `json:"owner_id"`
	Owner       string     `json:"owner"`
	Status      string     `json:"status"`
	Result      string     `json:"result,omitempty"`
	Comment     string     `json:"comment,omitempty"`
	DueAt       time.Time  `json:"due_at"`
	CreatedAt   time.Time  `json:"created_at"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`
}

type Signal struct {
	ID               string     `json:"id"`
	Title            string     `json:"title"`
	Scope            string     `json:"scope"`
	InternshipID     string     `json:"internship_id"`
	Dimension        string     `json:"dimension"`
	Urgency          string     `json:"urgency"`
	EvidenceStrength string     `json:"evidence_strength"`
	Status           string     `json:"status"`
	Summary          string     `json:"summary"`
	Rule             string     `json:"rule"`
	Evidence         []Evidence `json:"evidence"`
	OwnerID          string     `json:"owner_id,omitempty"`
	Owner            *Person    `json:"owner,omitempty"`
	DueAt            *time.Time `json:"due_at,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
	Actions          []Action   `json:"actions,omitempty"`
	History          []History  `json:"history,omitempty"`
}

type History struct {
	At      time.Time `json:"at"`
	ActorID string    `json:"actor_id"`
	Event   string    `json:"event"`
	Comment string    `json:"comment,omitempty"`
}

type Feedback struct {
	ID           string     `json:"id"`
	InternshipID string     `json:"internship_id"`
	AuthorID     string     `json:"author_id"`
	Author       string     `json:"author"`
	RecipientID  string     `json:"recipient_id"`
	Recipient    string     `json:"recipient"`
	Relation     string     `json:"relation"`
	Frequency    string     `json:"frequency"`
	Sentiment    string     `json:"sentiment"`
	Strengths    string     `json:"strengths"`
	Growth       string     `json:"growth"`
	Text         string     `json:"text"`
	Status       string     `json:"status"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
	PublishedAt  *time.Time `json:"published_at,omitempty"`
}

type FeedbackRequest struct {
	ID           string    `json:"id"`
	InternshipID string    `json:"internship_id"`
	RequesterID  string    `json:"requester_id"`
	RecipientID  string    `json:"recipient_id"`
	Message      string    `json:"message"`
	Status       string    `json:"status"`
	CreatedAt    time.Time `json:"created_at"`
}

type Review struct {
	ID               string     `json:"id"`
	InternshipID     string     `json:"internship_id"`
	Kind             string     `json:"kind"`
	AuthorID         string     `json:"author_id"`
	Text             string     `json:"text"`
	ManagerReasoning string     `json:"manager_reasoning,omitempty"`
	Score            float64    `json:"score,omitempty"`
	RecommendedLevel string     `json:"recommended_level,omitempty"`
	CalibratedLevel  string     `json:"calibrated_level,omitempty"`
	FinalLevel       string     `json:"final_level,omitempty"`
	Status           string     `json:"status"`
	Analysis         Map        `json:"analysis,omitempty"`
	AnnouncedAt      *time.Time `json:"announced_at,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

type Diagnostic struct {
	ID           string       `json:"id"`
	InternshipID string       `json:"internship_id"`
	Kind         int          `json:"kind"`
	Status       string       `json:"status"`
	Required     map[Role]int `json:"required"`
	Completed    map[Role]int `json:"completed"`
	Quorum       bool         `json:"quorum"`
	Results      Map          `json:"results,omitempty"`
	CreatedAt    time.Time    `json:"created_at"`
	CompletedAt  *time.Time   `json:"completed_at,omitempty"`
}

type Goal struct {
	ID           string    `json:"id"`
	InternshipID string    `json:"internship_id"`
	Title        string    `json:"title"`
	Description  string    `json:"description"`
	OwnerID      string    `json:"owner_id"`
	DueAt        time.Time `json:"due_at"`
	Progress     int       `json:"progress"`
	Status       string    `json:"status"`
	Result       string    `json:"result,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type Integration struct {
	ID          string     `json:"id"`
	Kind        string     `json:"kind"`
	Name        string     `json:"name"`
	Status      string     `json:"status"`
	LastSyncAt  *time.Time `json:"last_sync_at,omitempty"`
	ItemsSynced int        `json:"items_synced"`
	Config      Map        `json:"config"`
}

type JournalEntry struct {
	ID            string    `json:"id"`
	IntegrationID string    `json:"integration_id"`
	Event         string    `json:"event"`
	Status        string    `json:"status"`
	Message       string    `json:"message"`
	Items         int       `json:"items"`
	CreatedAt     time.Time `json:"created_at"`
}

type Settings struct {
	ShowFeedbackToIntern bool               `json:"show_feedback_to_intern"`
	SignalThresholds     map[string]float64 `json:"signal_thresholds"`
	ScaleMin             int                `json:"scale_min"`
	ScaleMax             int                `json:"scale_max"`
	UpdatedAt            time.Time          `json:"updated_at"`
	UpdatedBy            string             `json:"updated_by"`
}

type AILog struct {
	ID        string    `json:"id"`
	ActorID   string    `json:"actor_id"`
	Kind      string    `json:"kind"`
	Model     string    `json:"model"`
	Prompt    string    `json:"prompt_version"`
	ContextID string    `json:"context_id,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

type Notification struct {
	ID        string    `json:"id"`
	ActorID   string    `json:"actor_id"`
	Kind      string    `json:"kind"`
	Message   string    `json:"message"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
}

type Map map[string]any

type State struct {
	Revision         int64                      `json:"revision"`
	Sequence         int64                      `json:"sequence"`
	Actors           map[string]Actor           `json:"actors"`
	Teams            map[string]Team            `json:"teams"`
	Cohorts          map[string]Cohort          `json:"cohorts"`
	Internships      map[string]Internship      `json:"internships"`
	Surveys          map[string]Survey          `json:"surveys"`
	Assignments      map[string]Assignment      `json:"assignments"`
	Responses        map[string]Response        `json:"responses"`
	Metrics          map[string]MetricPoint     `json:"metrics"`
	Signals          map[string]Signal          `json:"signals"`
	Actions          map[string]Action          `json:"actions"`
	Feedback         map[string]Feedback        `json:"feedback"`
	FeedbackRequests map[string]FeedbackRequest `json:"feedback_requests"`
	Reviews          map[string]Review          `json:"reviews"`
	Diagnostics      map[string]Diagnostic      `json:"diagnostics"`
	Goals            map[string]Goal            `json:"goals"`
	Integrations     map[string]Integration     `json:"integrations"`
	Journal          map[string]JournalEntry    `json:"journal"`
	Imports          map[string]string          `json:"imports"`
	AILogs           map[string]AILog           `json:"ai_logs"`
	Notifications    map[string]Notification    `json:"notifications"`
	Settings         Settings                   `json:"settings"`
}
