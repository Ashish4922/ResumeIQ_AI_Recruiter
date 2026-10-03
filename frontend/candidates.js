const API_URL = "http://127.0.0.1:8000";

const token = localStorage.getItem("token");

const params = new URLSearchParams(
    window.location.search
);

const jobId = params.get("job_id");

const userName =
    document.getElementById("userName");

const logoutBtn =
    document.getElementById("logoutBtn");

const backBtn =
    document.getElementById("backBtn");

const uploadBtn =
    document.getElementById("uploadBtn");

const closeUploadBtn =
    document.getElementById("closeUploadBtn");

const uploadSection =
    document.getElementById("uploadSection");

const jobTitle =
    document.getElementById("jobTitle");

const jobMeta =
    document.getElementById("jobMeta");

const candidateCount =
    document.getElementById("candidateCount");

const shortlistedCount =
    document.getElementById("shortlistedCount");

const interviewCount =
    document.getElementById("interviewCount");

const averageScore =
    document.getElementById("averageScore");

const candidatesContainer =
    document.getElementById("candidatesContainer");

const resumeFiles =
    document.getElementById("resumeFiles");

const selectedFiles =
    document.getElementById("selectedFiles");

const screenBtn =
    document.getElementById("screenBtn");

const uploadMessage =
    document.getElementById("uploadMessage");

let allCandidates = [];
let filteredCandidates = [];
let selectedCandidateIds = [];

const interviewQuestionStyles =
    document.createElement("style");

interviewQuestionStyles.textContent = `
    .review-interview-section {
        margin-top: 24px;
        padding: 20px;
        border: 1px solid #eeeeee;
        border-radius: 12px;
    }

    .review-interview-header {
        margin-bottom: 15px;
    }

    .interview-questions-container {
        margin-top: 10px;
        max-height: 420px;
        overflow-y: auto;
    }

    .interview-question-list {
        margin: 0;
        padding-left: 28px;
    }

    .interview-question-list li {
        margin-bottom: 12px;
        padding-left: 5px;
        color: #222222;
        line-height: 1.5;
        font-size: 14px;
    }

    .interview-empty-state,
    .interview-loading-state {
        padding: 14px;
        border-radius: 8px;
        background: #f7f7fa;
        color: #666666;
        font-size: 14px;
    }

    .generate-interview-button {
        margin-top: 15px;
        padding: 11px 16px;
        border: none;
        border-radius: 8px;
        background: #111111;
        color: #ffffff;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
    }

        .generate-interview-button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .candidate-interview-summary {
        margin-top: 18px;
        padding: 15px;
        border: 1px solid #eeeeee;
        border-radius: 10px;
        background: #fafafa;
    }

    .candidate-interview-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 10px;
    }

    .candidate-interview-header span {
        font-size: 13px;
        font-weight: 600;
        color: #666666;
        text-transform: uppercase;
        letter-spacing: 0.04em;
    }

    .candidate-interview-header strong {
        font-size: 13px;
        color: #111111;
    }

    .candidate-interview-details {
        display: flex;
        flex-wrap: wrap;
        gap: 10px 18px;
    }

    .candidate-interview-details span {
        font-size: 13px;
        color: #444444;
    }
`;

document.head.appendChild(
    interviewQuestionStyles
);

if (!token) {
    window.location.href = "login.html";
}

if (!jobId) {
    window.location.href = "recruiter.html";
}


async function loadPage() {

    try {

        const userResponse =
            await fetch(
                `${API_URL}/me`,
                {
                    headers: {
                        Authorization:
                            `Bearer ${token}`
                    }
                }
            );

        if (!userResponse.ok) {
            logout();
            return;
        }

        const user =
            await userResponse.json();

        if (user.role !== "recruiter") {

            window.location.href =
                "index.html";

            return;
        }

        if (userName) {
            userName.textContent =
                user.name;
        }

        await loadJob();
        await loadCandidates();

    } catch (error) {

        console.error(
            "Could not load page:",
            error
        );

    }

}


async function loadJob() {

    try {

        const response =
            await fetch(
                `${API_URL}/jobs/${jobId}`,
                {
                    headers: {
                        Authorization:
                            `Bearer ${token}`
                    }
                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            alert(
                data.detail ||
                "Job not found."
            );

            window.location.href =
                "recruiter.html";

            return;
        }

        const job =
            data.job;

        if (jobTitle) {
            jobTitle.textContent =
                job.title;
        }

        const metaParts = [];

        if (job.company) {
            metaParts.push(
                job.company
            );
        }

        if (job.location) {
            metaParts.push(
                job.location
            );
        }

        if (job.experience) {
            metaParts.push(
                job.experience
            );
        }

        if (jobMeta) {
            jobMeta.textContent =
                metaParts.join(" • ");
        }

    } catch (error) {

        console.error(
            "Could not load job:",
            error
        );

    }

}


async function loadCandidates() {

    try {

        const response =
            await fetch(
                `${API_URL}/jobs/${jobId}/candidates`,
                {
                    headers: {
                        Authorization:
                            `Bearer ${token}`
                    }
                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            console.error(
                data.detail ||
                "Could not load candidates."
            );

            return;
        }

        allCandidates =
            Array.isArray(data.candidates)
                ? data.candidates
                : [];

        selectedCandidateIds = [];

        updateCandidateStats(
            allCandidates
        );

        setupCandidateTools();

        applyCandidateFilters();

    } catch (error) {

        console.error(
            "Could not load candidates:",
            error
        );

    }

}


function updateCandidateStats(
    candidates
) {

    if (candidateCount) {

        candidateCount.textContent =
            candidates.length;

    }

    const shortlisted =
        candidates.filter(
            candidate =>
                candidate.status ===
                "shortlisted"
        ).length;

    const interviews =
        candidates.filter(
            candidate =>
                candidate.status ===
                "interview"
        ).length;

    if (shortlistedCount) {

        shortlistedCount.textContent =
            shortlisted;

    }

    if (interviewCount) {

        interviewCount.textContent =
            interviews;

    }

    const scoredCandidates =
        candidates.filter(
            candidate => {

                const score =
                    Number(
                        candidate.match_score
                    );

                return (
                    candidate.match_score !==
                        null &&
                    candidate.match_score !==
                        undefined &&
                    !Number.isNaN(score)
                );

            }
        );

    if (
        averageScore &&
        scoredCandidates.length > 0
    ) {

        const total =
            scoredCandidates.reduce(
                (sum, candidate) =>
                    sum +
                    Number(
                        candidate.match_score
                    ),
                0
            );

        const average =
            Math.round(
                total /
                scoredCandidates.length
            );

        averageScore.textContent =
            `${average}%`;

    } else if (averageScore) {

        averageScore.textContent =
            "-";

    }

}


function setupCandidateTools() {

    if (
        document.getElementById(
            "candidateTools"
        )
    ) {

        return;

    }

    const tools =
        document.createElement(
            "div"
        );

    tools.id =
        "candidateTools";

    tools.className =
        "candidate-tools";

    tools.innerHTML = `

        <div class="candidate-search-box">

            <input
                type="text"
                id="candidateSearch"
                placeholder="Search candidate, email, skill..."
            >

        </div>

        <div class="candidate-filter-row">

            <select id="candidateStatusFilter">

                <option value="all">
                    All Status
                </option>

                <option value="review">
                    Review
                </option>

                <option value="shortlisted">
                    Shortlisted
                </option>

                <option value="interview">
                    Interview
                </option>

                <option value="rejected">
                    Rejected
                </option>

            </select>

            <select id="candidateScoreFilter">

                <option value="0">
                    All Scores
                </option>

                <option value="70">
                    70%+
                </option>

                <option value="50">
                    50%+
                </option>

                <option value="30">
                    30%+
                </option>

            </select>

            <select id="candidateSort">

                <option value="newest">
                    Newest
                </option>

                <option value="score-high">
                    Match Score: High to Low
                </option>

                <option value="score-low">
                    Match Score: Low to High
                </option>

                <option value="name">
                    Name
                </option>

            </select>

        </div>

        <div class="candidate-tool-actions">

            <button
                type="button"
                class="secondary-button"
                id="compareCandidatesBtn"
            >
                Compare Selected
            </button>

            <button
                type="button"
                class="secondary-button"
                id="exportCandidatesBtn"
            >
                Export CSV
            </button>

            <span
                id="selectedCandidateCount"
                class="selected-count"
            >
                0 selected
            </span>

        </div>

    `;

    candidatesContainer.parentElement.insertBefore(
        tools,
        candidatesContainer
    );

    document
        .getElementById(
            "candidateSearch"
        )
        .addEventListener(
            "input",
            applyCandidateFilters
        );

    document
        .getElementById(
            "candidateStatusFilter"
        )
        .addEventListener(
            "change",
            applyCandidateFilters
        );

    document
        .getElementById(
            "candidateScoreFilter"
        )
        .addEventListener(
            "change",
            applyCandidateFilters
        );

    document
        .getElementById(
            "candidateSort"
        )
        .addEventListener(
            "change",
            applyCandidateFilters
        );

    document
        .getElementById(
            "compareCandidatesBtn"
        )
        .addEventListener(
            "click",
            compareSelectedCandidates
        );

    document
        .getElementById(
            "exportCandidatesBtn"
        )
        .addEventListener(
            "click",
            exportCandidatesCSV
        );

}


function applyCandidateFilters() {

    const search =
        (
            document.getElementById(
                "candidateSearch"
            )?.value || ""
        )
            .trim()
            .toLowerCase();

    const status =
        document.getElementById(
            "candidateStatusFilter"
        )?.value || "all";

    const minimumScore =
        Number(
            document.getElementById(
                "candidateScoreFilter"
            )?.value || 0
        );

    const sort =
        document.getElementById(
            "candidateSort"
        )?.value || "newest";

    filteredCandidates =
        allCandidates.filter(
            candidate => {

                const searchableText = [

                    candidate.candidate_name,

                    candidate.candidate_email,

                    candidate.resume_filename,

                    candidate.matched_skills,

                    candidate.missing_skills

                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase();

                const matchesSearch =
                    !search ||
                    searchableText.includes(
                        search
                    );

                const matchesStatus =
                    status === "all" ||
                    candidate.status ===
                        status;

                const score =
                    Number(
                        candidate.match_score
                    ) || 0;

                const matchesScore =
                    score >= minimumScore;

                return (
                    matchesSearch &&
                    matchesStatus &&
                    matchesScore
                );

            }
        );

    filteredCandidates.sort(
        (a, b) => {

            if (
                sort ===
                "score-high"
            ) {

                return (
                    (
                        Number(
                            b.match_score
                        ) || 0
                    ) -
                    (
                        Number(
                            a.match_score
                        ) || 0
                    )
                );

            }

            if (
                sort ===
                "score-low"
            ) {

                return (
                    (
                        Number(
                            a.match_score
                        ) || 0
                    ) -
                    (
                        Number(
                            b.match_score
                        ) || 0
                    )
                );

            }

            if (
                sort ===
                "name"
            ) {

                return (
                    (
                        a.candidate_name ||
                        ""
                    ).localeCompare(
                        b.candidate_name ||
                        ""
                    )
                );

            }

            return (
                new Date(
                    b.created_at ||
                    0
                ) -
                new Date(
                    a.created_at ||
                    0
                )
            );

        }
    );

    renderFilteredCandidates();

}


function renderFilteredCandidates() {

    if (
        filteredCandidates.length === 0
    ) {

        candidatesContainer.innerHTML = `

            <div class="empty-state">

                <div class="empty-icon">
                    🔎
                </div>

                <h3>
                    No candidates found
                </h3>

                <p>
                    Try changing your search or filters.
                </p>

            </div>

        `;

        updateSelectedCount();

        return;

    }

    candidatesContainer.innerHTML =
        filteredCandidates
            .map(
                candidate =>
                    createCandidateCard(
                        candidate
                    )
            )
            .join("");

    updateSelectedCount();

}


function createCandidateCard(
    candidate
) {

    const score =
        candidate.match_score !==
            null &&
        candidate.match_score !==
            undefined
            ? `${candidate.match_score}%`
            : "Pending";

    const status =
        candidate.status ||
        "review";

    const hasInterview =
        candidate.interview_date ||
        candidate.interview_time ||
        candidate.interviewer ||
        candidate.interview_status;

    const interviewStatus =
        candidate.interview_status ||
        "scheduled";

    return `

        <div class="candidate-card">

            <div class="candidate-header">

                <div class="candidate-select-area">

                    <input
                        type="checkbox"
                        class="candidate-select"
                        data-candidate-id="${candidate.id}"
                        ${
                            selectedCandidateIds.includes(
                                candidate.id
                            )
                                ? "checked"
                                : ""
                        }
                        onchange="toggleCandidateSelection(${candidate.id})"
                    >

                    <div>

                        <h3>
                            ${escapeHtml(
                                candidate.candidate_name ||
                                "Unnamed Candidate"
                            )}
                        </h3>

                        <p>
                            ${escapeHtml(
                                candidate.candidate_email ||
                                "Email not provided"
                            )}
                        </p>

                    </div>

                </div>

                <button
                    type="button"
                    class="candidate-review-button"
                    onclick="openCandidateReview(${candidate.id})"
                >
                    Review
                </button>

            </div>

            <div class="candidate-details">

                <div>

                    <span>
                        Resume
                    </span>

                    <strong>
                        ${escapeHtml(
                            candidate.resume_filename ||
                            ""
                        )}
                    </strong>

                </div>

                <div>

                    <span>
                        Match Score
                    </span>

                    <strong>
                        ${score}
                    </strong>

                </div>

                <div>

                    <span>
                        Skills
                    </span>

                    <strong>
                        ${formatScore(
                            candidate.skills_match
                        )}
                    </strong>

                </div>

                <div>

                    <span>
                        Experience
                    </span>

                    <strong>
                        ${formatScore(
                            candidate.experience_match
                        )}
                    </strong>

                </div>

                <div>

                    <span>
                        Education
                    </span>

                    <strong>
                        ${formatScore(
                            candidate.education_match
                        )}
                    </strong>

                </div>

            </div>

            <div class="candidate-skills">

                <span>
                    Matched Skills
                </span>

                <p>
                    ${escapeHtml(
                        candidate.matched_skills ||
                        "None"
                    )}
                </p>

            </div>

            <div class="candidate-skills">

                <span>
                    Missing Skills
                </span>

                <p>
                    ${escapeHtml(
                        candidate.missing_skills ||
                        "None"
                    )}
                </p>

            </div>

            ${
                hasInterview
                    ? `
                        <div class="candidate-interview-summary">

                            <div class="candidate-interview-header">

                                <span>
                                    Interview
                                </span>

                                <strong>
                                    ${escapeHtml(
                                        formatStatus(
                                            interviewStatus
                                        )
                                    )}
                                </strong>

                            </div>

                            <div class="candidate-interview-details">

                                ${
                                    candidate.interview_date
                                        ? `
                                            <span>
                                                📅
                                                ${formatDate(
                                                    candidate.interview_date
                                                )}
                                            </span>
                                        `
                                        : ""
                                }

                                ${
                                    candidate.interview_time
                                        ? `
                                            <span>
                                                🕐
                                                ${escapeHtml(
                                                    candidate.interview_time
                                                )}
                                            </span>
                                        `
                                        : ""
                                }

                                ${
                                    candidate.interview_type
                                        ? `
                                            <span>
                                                💻
                                                ${escapeHtml(
                                                    candidate.interview_type
                                                )}
                                            </span>
                                        `
                                        : ""
                                }

                                ${
                                    candidate.interviewer
                                        ? `
                                            <span>
                                                👤
                                                ${escapeHtml(
                                                    candidate.interviewer
                                                )}
                                            </span>
                                        `
                                        : ""
                                }

                            </div>

                        </div>
                    `
                    : ""
            }

            <div class="candidate-footer">

                <span>
                    Status:
                    ${escapeHtml(
                        formatStatus(
                            status
                        )
                    )}
                </span>

                <span>
                    Added:
                    ${formatDate(
                        candidate.created_at
                    )}
                </span>

            </div>

        </div>

    `;

}


async function openCandidateReview(
    candidateId
) {

    try {

        const response =
            await fetch(
                `${API_URL}/jobs/${jobId}/candidates`,
                {
                    headers: {
                        Authorization:
                            `Bearer ${token}`
                    }
                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            alert(
                data.detail ||
                "Could not load candidate."
            );

            return;

        }

        const candidate =
            data.candidates.find(
                item =>
                    item.id ===
                    candidateId
            );

        if (!candidate) {

            alert(
                "Candidate not found."
            );

            return;

        }

        const oldModal =
            document.getElementById(
                "candidateReviewModal"
            );

        if (oldModal) {
            oldModal.remove();
        }

        const matchedSkills =
            candidate.matched_skills ||
            "No matched skills available.";

        const missingSkills =
            candidate.missing_skills ||
            "No missing skills available.";

        const notes =
            candidate.notes ||
            "";

        const modal =
            document.createElement(
                "div"
            );

        modal.id =
            "candidateReviewModal";

        modal.className =
            "candidate-review-modal";

        modal.innerHTML = `

            <div
                class="candidate-review-overlay"
                onclick="handleReviewOverlayClick(event)"
            >

                <div
                    class="candidate-review-panel"
                    onclick="event.stopPropagation()"
                >

                    <div class="candidate-review-header">

                        <div>

                            <span class="review-label">
                                CANDIDATE REVIEW
                            </span>

                            <h2>
                                ${escapeHtml(
                                    candidate.candidate_name ||
                                    "Unnamed Candidate"
                                )}
                            </h2>

                            <p>
                                ${escapeHtml(
                                    candidate.candidate_email ||
                                    "Email not provided"
                                )}
                            </p>

                        </div>

                        <button
                            type="button"
                            class="review-close-button"
                            onclick="closeCandidateReview()"
                        >
                            ×
                        </button>

                    </div>

                    <div class="review-score">

                        <div>
                            <span>
                                Match Score
                            </span>

                            <strong>
                                ${
                                    candidate.match_score !==
                                        null &&
                                    candidate.match_score !==
                                        undefined
                                        ? candidate.match_score +
                                          "%"
                                        : "-"
                                }
                            </strong>
                        </div>

                        <div>
                            <span>
                                Skills
                            </span>

                            <strong>
                                ${formatScore(
                                    candidate.skills_match
                                )}
                            </strong>
                        </div>

                        <div>
                            <span>
                                Experience
                            </span>

                            <strong>
                                ${formatScore(
                                    candidate.experience_match
                                )}
                            </strong>
                        </div>

                        <div>
                            <span>
                                Education
                            </span>

                            <strong>
                                ${formatScore(
                                    candidate.education_match
                                )}
                            </strong>
                        </div>

                    </div>

                    <div class="review-section">

                        <span>
                            Resume
                        </span>

                        <p>
                            ${escapeHtml(
                                candidate.resume_filename ||
                                ""
                            )}
                        </p>

                    </div>

                    <div class="review-section">

                        <span>
                            Matched Skills
                        </span>

                        <p>
                            ${escapeHtml(
                                matchedSkills
                            )}
                        </p>

                    </div>

                    <div class="review-section">

                        <span>
                            Missing Skills
                        </span>

                        <p>
                            ${escapeHtml(
                                missingSkills
                            )}
                        </p>

                    </div>

                    <div class="review-status">

                        <span>
                            Current Status
                        </span>

                        <strong>
                            ${escapeHtml(
                                formatStatus(
                                    candidate.status ||
                                    "review"
                                )
                            )}
                        </strong>

                    </div>

                    <div class="review-notes-section">

                        <div class="review-notes-header">

                            <span class="review-section-title">
                                Recruiter Notes
                            </span>

                            <p class="review-notes-description">
                                Add private notes about this candidate.
                            </p>

                        </div>

                        <textarea
                            id="candidateNotes"
                            class="candidate-notes-input"
                            placeholder="Write your notes about this candidate..."
                        >${escapeHtml(notes)}</textarea>

                        <div
                            id="notesMessage"
                            class="notes-message"
                        ></div>

                        <button
                            type="button"
                            class="save-notes-button"
                            onclick="saveCandidateNotes(${candidate.id})"
                        >
                            Save Notes
                        </button>

                    </div>

                    <div class="review-interview-section">

                        <div class="review-interview-header">

                            <span class="review-section-title">
                                Interview Questions
                            </span>

                            <p class="review-notes-description">
                                Generate candidate-specific interview questions using the resume and job requirements.
                            </p>

                        </div>

                        <div
                            id="interviewQuestionsContainer"
                            class="interview-questions-container"
                        >

                            ${
                                candidate.interview_questions
                                    ? renderInterviewQuestions(
                                        candidate.interview_questions
                                    )
                                    : `
                                        <div class="interview-empty-state">
                                            No interview questions generated yet.
                                        </div>
                                    `
                            }

                        </div>

                        <div
                            id="interviewQuestionsMessage"
                            class="notes-message"
                        ></div>

                        <button
                            type="button"
                            class="generate-interview-button"
                            id="generateInterviewButton"
                            onclick="generateInterviewQuestions(${candidate.id})"
                        >
                            ${
                                candidate.interview_questions
                                    ? "Regenerate Interview Questions"
                                    : "Generate Interview Questions"
                            }
                        </button>

                    </div>

                    <div class="review-actions">

                        <button
                            type="button"
                            class="review-action-button"
                            onclick="updateCandidateStatus(
                                ${candidate.id},
                                'review'
                            )"
                        >
                            Review
                        </button>

                        <button
                            type="button"
                            class="review-action-button"
                            onclick="updateCandidateStatus(
                                ${candidate.id},
                                'shortlisted'
                            )"
                        >
                            Shortlist
                        </button>

                        <button
                            type="button"
                            class="review-action-button"
                            onclick="updateCandidateStatus(
                                ${candidate.id},
                                'interview'
                            )"
                        >
                            Interview
                        </button>

                        <button
                            type="button"
                            class="review-action-button reject-button"
                            onclick="updateCandidateStatus(
                                ${candidate.id},
                                'rejected'
                            )"
                        >
                            Reject
                        </button>

                    </div>

                </div>

            </div>

        `;

                document.body.appendChild(
            modal
        );

        addInterviewManagement(
            candidate
        );

        document.body.style.overflow =
            "hidden";

    } catch (error) {

        console.error(
            "Candidate review error:",
            error
        );

        alert(
            "Could not load candidate review."
        );

    }

}


function renderInterviewQuestions(
    questions
) {

    if (!questions) {

        return `
            <div class="interview-empty-state">
                No interview questions generated yet.
            </div>
        `;

    }

    let questionList = [];

    if (Array.isArray(questions)) {

        questionList =
            questions;

    } else {

        questionList =
            String(questions)
                .split("\n")
                .map(
                    question =>
                        question
                            .replace(
                                /^\s*\d+[.)]\s*/,
                                ""
                            )
                            .trim()
                )
                .filter(Boolean);

    }

    if (
        questionList.length === 0
    ) {

        return `
            <div class="interview-empty-state">
                No interview questions generated yet.
            </div>
        `;

    }

    return `
        <ol class="interview-question-list">

            ${questionList
                .map(
                    question => `
                        <li>
                            ${escapeHtml(
                                question
                            )}
                        </li>
                    `
                )
                .join("")}

        </ol>
    `;

}


async function generateInterviewQuestions(
    candidateId
) {

    const button =
        document.getElementById(
            "generateInterviewButton"
        );

    const container =
        document.getElementById(
            "interviewQuestionsContainer"
        );

    const message =
        document.getElementById(
            "interviewQuestionsMessage"
        );

    if (!button || !container) {
        return;
    }

    button.disabled =
        true;

    button.textContent =
        "Generating Questions...";

    if (message) {
        message.innerHTML = "";
    }

    container.innerHTML = `
        <div class="interview-loading-state">
            Generating 10 candidate-specific interview questions...
        </div>
    `;

    try {

        const response =
            await fetch(
                `${API_URL}/jobs/${jobId}/candidates/${candidateId}/generate-interview-questions`,
                {
                    method: "POST",

                    headers: {
                        Authorization:
                            `Bearer ${token}`
                    }
                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            container.innerHTML = `
                <div class="message error">
                    ${escapeHtml(
                        data.detail ||
                        "Could not generate interview questions."
                    )}
                </div>
            `;

            return;

        }

        const questions =
            Array.isArray(data.questions)
                ? data.questions
                : [];

        if (
            questions.length === 0
        ) {

            container.innerHTML = `
                <div class="message error">
                    No interview questions were returned.
                </div>
            `;

            return;

        }

        container.innerHTML =
            renderInterviewQuestions(
                questions
            );

        button.textContent =
            "Regenerate Interview Questions";

        if (message) {

            message.innerHTML = `
                <div class="message success">
                    ${questions.length} interview questions generated and saved.
                </div>
            `;

        }

    } catch (error) {

        console.error(
            "Interview question generation error:",
            error
        );

        container.innerHTML = `
            <div class="message error">
                Could not connect to the backend.
            </div>
        `;

    } finally {

        button.disabled =
            false;

        if (
            button.textContent ===
            "Generating Questions..."
        ) {

            button.textContent =
                "Generate Interview Questions";

        }

    }

}


async function saveCandidateNotes(
    candidateId
) {

    const notesInput =
        document.getElementById(
            "candidateNotes"
        );

    const notesMessage =
        document.getElementById(
            "notesMessage"
        );

    if (!notesInput) {
        return;
    }

    const notes =
        notesInput.value.trim();

    const saveButton =
        document.querySelector(
            ".save-notes-button"
        );

    if (saveButton) {

        saveButton.disabled =
            true;

        saveButton.textContent =
            "Saving...";

    }

    if (notesMessage) {
        notesMessage.innerHTML = "";
    }

    try {

        const response =
            await fetch(
                `${API_URL}/jobs/${jobId}/candidates/${candidateId}/notes`,
                {
                    method: "PATCH",

                    headers: {
                        "Content-Type":
                            "application/json",

                        Authorization:
                            `Bearer ${token}`
                    },

                    body: JSON.stringify({
                        notes: notes
                    })
                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            if (notesMessage) {

                notesMessage.innerHTML = `
                    <div class="message error">
                        ${escapeHtml(
                            data.detail ||
                            "Could not save notes."
                        )}
                    </div>
                `;

            }

            return;

        }

        if (notesMessage) {

            notesMessage.innerHTML = `
                <div class="message success">
                    Notes saved successfully.
                </div>
            `;

        }

        const candidate =
            allCandidates.find(
                item =>
                    item.id ===
                    candidateId
            );

        if (candidate) {
            candidate.notes =
                notes;
        }

    } catch (error) {

        console.error(
            "Save notes error:",
            error
        );

        if (notesMessage) {

            notesMessage.innerHTML = `
                <div class="message error">
                    Could not connect to the backend.
                </div>
            `;

        }

    } finally {

        if (saveButton) {

            saveButton.disabled =
                false;

            saveButton.textContent =
                "Save Notes";

        }

    }

}


function closeCandidateReview() {

    const modal =
        document.getElementById(
            "candidateReviewModal"
        );

    if (modal) {
        modal.remove();
    }

    document.body.style.overflow =
        "";

}


function handleReviewOverlayClick(
    event
) {

    if (
        event.target.classList.contains(
            "candidate-review-overlay"
        )
    ) {

        closeCandidateReview();

    }

}


async function updateCandidateStatus(
    candidateId,
    status
) {

    try {

        const response =
            await fetch(
                `${API_URL}/jobs/${jobId}/candidates/${candidateId}/status`,
                {
                    method: "PATCH",

                    headers: {
                        "Content-Type":
                            "application/json",

                        Authorization:
                            `Bearer ${token}`
                    },

                    body: JSON.stringify({
                        status: status
                    })
                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            alert(
                data.detail ||
                "Could not update candidate status."
            );

            return;

        }

        closeCandidateReview();

        await loadCandidates();

    } catch (error) {

        console.error(
            "Status update error:",
            error
        );

        alert(
            "Could not connect to the backend."
        );

    }

}


function formatScore(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "-";

    }

    return `${value}%`;

}


function formatStatus(status) {

    const statusMap = {

        review:
            "Review",

        shortlisted:
            "Shortlisted",

        interview:
            "Interview",

        rejected:
            "Rejected",

        screening_failed:
            "Screening Failed"

    };

    return (
        statusMap[status] ||
        status
    );

}


function formatDate(value) {

    if (!value) {
        return "";
    }

    const date =
        new Date(
            String(value).replace(
                " ",
                "T"
            )
        );

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return value;

    }

    return date.toLocaleDateString(
        "en-IN",
        {
            day: "numeric",
            month: "short",
            year: "numeric"
        }
    );

}


function escapeHtml(value) {

    const div =
        document.createElement(
            "div"
        );

    div.textContent =
        value || "";

    return div.innerHTML;

}


function toggleCandidateSelection(
    candidateId
) {

    if (
        selectedCandidateIds.includes(
            candidateId
        )
    ) {

        selectedCandidateIds =
            selectedCandidateIds.filter(
                id =>
                    id !== candidateId
            );

    } else {

        if (
            selectedCandidateIds.length >= 4
        ) {

            alert(
                "You can compare up to 4 candidates at a time."
            );

            applyCandidateFilters();

            return;

        }

        selectedCandidateIds.push(
            candidateId
        );

    }

    updateSelectedCount();

}


function updateSelectedCount() {

    const element =
        document.getElementById(
            "selectedCandidateCount"
        );

    if (element) {

        element.textContent =
            `${selectedCandidateIds.length} selected`;

    }

}


function compareSelectedCandidates() {

    if (
        selectedCandidateIds.length < 2
    ) {

        alert(
            "Select at least 2 candidates to compare."
        );

        return;

    }

    const candidates =
        allCandidates.filter(
            candidate =>
                selectedCandidateIds.includes(
                    candidate.id
                )
        );

    const modal =
        document.createElement(
            "div"
        );

    modal.id =
        "candidateCompareModal";

    modal.className =
        "candidate-review-modal";

    modal.innerHTML = `

        <div
            class="candidate-review-overlay"
            onclick="closeCandidateComparison(event)"
        >

            <div
                class="candidate-review-panel comparison-panel"
                onclick="event.stopPropagation()"
            >

                <div class="candidate-review-header">

                    <div>

                        <span class="review-label">
                            CANDIDATE COMPARISON
                        </span>

                        <h2>
                            Compare Candidates
                        </h2>

                        <p>
                            Side-by-side screening information.
                        </p>

                    </div>

                    <button
                        type="button"
                        class="review-close-button"
                        onclick="closeCandidateComparison()"
                    >
                        ×
                    </button>

                </div>

                <div class="comparison-table">

                    ${candidates
                        .map(
                            candidate => `

                                <div class="comparison-column">

                                    <h3>
                                        ${escapeHtml(
                                            candidate.candidate_name ||
                                            "Unnamed"
                                        )}
                                    </h3>

                                    <p>
                                        ${escapeHtml(
                                            candidate.candidate_email ||
                                            "Email not provided"
                                        )}
                                    </p>

                                    <div>
                                        <span>
                                            Match
                                        </span>

                                        <strong>
                                            ${formatScore(
                                                candidate.match_score
                                            )}
                                        </strong>
                                    </div>

                                    <div>
                                        <span>
                                            Skills
                                        </span>

                                        <strong>
                                            ${formatScore(
                                                candidate.skills_match
                                            )}
                                        </strong>
                                    </div>

                                    <div>
                                        <span>
                                            Experience
                                        </span>

                                        <strong>
                                            ${formatScore(
                                                candidate.experience_match
                                            )}
                                        </strong>
                                    </div>

                                    <div>
                                        <span>
                                            Education
                                        </span>

                                        <strong>
                                            ${formatScore(
                                                candidate.education_match
                                            )}
                                        </strong>
                                    </div>

                                    <div>
                                        <span>
                                            Status
                                        </span>

                                        <strong>
                                            ${escapeHtml(
                                                formatStatus(
                                                    candidate.status ||
                                                    "review"
                                                )
                                            )}
                                        </strong>
                                    </div>

                                    <div>
                                        <span>
                                            Matched Skills
                                        </span>

                                        <p>
                                            ${escapeHtml(
                                                candidate.matched_skills ||
                                                "None"
                                            )}
                                        </p>
                                    </div>

                                    <div>
                                        <span>
                                            Missing Skills
                                        </span>

                                        <p>
                                            ${escapeHtml(
                                                candidate.missing_skills ||
                                                "None"
                                            )}
                                        </p>
                                    </div>

                                </div>

                            `
                        )
                        .join("")}

                </div>

            </div>

        </div>

    `;

    document.body.appendChild(
        modal
    );

    document.body.style.overflow =
        "hidden";

}


function closeCandidateComparison(
    event
) {

    if (
        event &&
        !event.target.classList.contains(
            "candidate-review-overlay"
        )
    ) {

        return;

    }

    const modal =
        document.getElementById(
            "candidateCompareModal"
        );

    if (modal) {
        modal.remove();
    }

    document.body.style.overflow =
        "";

}


function exportCandidatesCSV() {

    if (
        allCandidates.length === 0
    ) {

        alert(
            "There are no candidates to export."
        );

        return;

    }

    const candidatesToExport =
        filteredCandidates.length > 0
            ? filteredCandidates
            : allCandidates;

    const rows = [

        [
            "Candidate Name",
            "Email",
            "Match Score",
            "Skills Match",
            "Experience Match",
            "Education Match",
            "Status",
            "Matched Skills",
            "Missing Skills",
            "Notes"
        ]

    ];

    candidatesToExport.forEach(
        candidate => {

            rows.push([

                candidate.candidate_name ||
                    "",

                candidate.candidate_email ||
                    "",

                candidate.match_score ??
                    "",

                candidate.skills_match ??
                    "",

                candidate.experience_match ??
                    "",

                candidate.education_match ??
                    "",

                candidate.status ||
                    "",

                candidate.matched_skills ||
                    "",

                candidate.missing_skills ||
                    "",

                candidate.notes ||
                    ""

            ]);

        }
    );

    const csv =
        rows
            .map(
                row =>
                    row
                        .map(
                            value =>
                                `"${String(value)
                                    .replace(
                                        /"/g,
                                        '""'
                                    )}"`
                        )
                        .join(",")
            )
            .join("\n");

    const blob =
        new Blob(
            [csv],
            {
                type:
                    "text/csv;charset=utf-8;"
            }
        );

    const url =
        URL.createObjectURL(
            blob
        );

    const link =
        document.createElement(
            "a"
        );

    link.href =
        url;

    link.download =
        `ResumeIQ_${jobTitle.textContent}_Candidates.csv`;

    document.body.appendChild(
        link
    );

    link.click();

    link.remove();

    URL.revokeObjectURL(
        url
    );

}


uploadBtn.addEventListener(
    "click",
    function() {

        uploadSection.classList.remove(
            "hidden"
        );

        uploadSection.scrollIntoView({
            behavior: "smooth"
        });

    }
);


closeUploadBtn.addEventListener(
    "click",
    function() {

        uploadSection.classList.add(
            "hidden"
        );

        resumeFiles.value =
            "";

        selectedFiles.innerHTML =
            "";

        screenBtn.classList.add(
            "hidden"
        );

        uploadMessage.innerHTML =
            "";

    }
);


resumeFiles.addEventListener(
    "change",
    function() {

        selectedFiles.innerHTML =
            "";

        const files =
            Array.from(
                resumeFiles.files
            );

        if (
            files.length === 0
        ) {

            screenBtn.classList.add(
                "hidden"
            );

            return;

        }

        files.forEach(
            file => {

                const item =
                    document.createElement(
                        "div"
                    );

                item.className =
                    "file-item";

                item.textContent =
                    `📄 ${file.name}`;

                selectedFiles.appendChild(
                    item
                );

            }
        );

        screenBtn.classList.remove(
            "hidden"
        );

    }
);


screenBtn.addEventListener(
    "click",
    async function() {

        const files =
            Array.from(
                resumeFiles.files
            );

        if (
            files.length === 0
        ) {
            return;
        }

        screenBtn.disabled =
            true;

        screenBtn.textContent =
            "AI Screening...";

        uploadMessage.innerHTML = `
            <div class="message">
                Analyzing ${files.length}
                resume(s) with AI...
            </div>
        `;

        const formData =
            new FormData();

        files.forEach(
            file => {

                formData.append(
                    "files",
                    file
                );

            }
        );

        try {

            const response =
                await fetch(
                    `${API_URL}/jobs/${jobId}/upload-resumes`,
                    {
                        method: "POST",

                        headers: {
                            Authorization:
                                `Bearer ${token}`
                        },

                        body: formData
                    }
                );

            const data =
                await response.json();

            if (!response.ok) {

                uploadMessage.innerHTML = `
                    <div class="message error">
                        ${escapeHtml(
                            data.detail ||
                            "AI screening failed."
                        )}
                    </div>
                `;

                return;

            }

            const successful =
                data.candidates.filter(
                    candidate =>
                        candidate.status ===
                        "review"
                ).length;

            const failed =
                data.candidates.filter(
                    candidate =>
                        candidate.status ===
                        "screening_failed"
                ).length;

            const duplicates =
                data.candidates.filter(
                    candidate =>
                        candidate.status ===
                        "duplicate"
                ).length;

            uploadMessage.innerHTML = `
                <div class="message success">

                    AI screening completed for
                    ${successful}
                    resume(s).

                    ${
                        failed > 0
                            ? `${failed} resume(s) failed.`
                            : ""
                    }

                    ${
                        duplicates > 0
                            ? `${duplicates} duplicate resume(s) skipped.`
                            : ""
                    }

                </div>
            `;

            resumeFiles.value =
                "";

            selectedFiles.innerHTML =
                "";

            screenBtn.classList.add(
                "hidden"
            );

            await loadCandidates();

        } catch (error) {

            console.error(
                "AI screening error:",
                error
            );

            uploadMessage.innerHTML = `
                <div class="message error">
                    Could not connect to the backend.
                </div>
            `;

        } finally {

            screenBtn.disabled =
                false;

            screenBtn.textContent =
                "Start AI Screening";

        }

    }
);


backBtn.addEventListener(
    "click",
    function() {

        window.location.href =
            "recruiter.html";

    }
);


logoutBtn.addEventListener(
    "click",
    logout
);


function logout() {

    localStorage.removeItem(
        "token"
    );

    localStorage.removeItem(
        "role"
    );

    localStorage.removeItem(
        "userName"
    );

    window.location.href =
        "login.html";

}


loadPage();

async function saveInterviewDetails(
    candidateId
) {

    const dateInput =
        document.getElementById(
            "interviewDate"
        );

    const timeInput =
        document.getElementById(
            "interviewTime"
        );

    const typeInput =
        document.getElementById(
            "interviewType"
        );

    const interviewerInput =
        document.getElementById(
            "interviewer"
        );

    const statusInput =
        document.getElementById(
            "interviewStatus"
        );

    const notesInput =
        document.getElementById(
            "interviewNotes"
        );

    const message =
        document.getElementById(
            "interviewManagementMessage"
        );

    const saveButton =
        document.getElementById(
            "saveInterviewButton"
        );

    if (
        !dateInput ||
        !timeInput ||
        !typeInput ||
        !interviewerInput ||
        !statusInput ||
        !notesInput
    ) {
        return;
    }

    if (
        statusInput.value === "scheduled" &&
        !dateInput.value
    ) {

        message.innerHTML = `
            <div class="message error">
                Please select an interview date.
            </div>
        `;

        return;
    }

    if (
        statusInput.value === "scheduled" &&
        !timeInput.value
    ) {

        message.innerHTML = `
            <div class="message error">
                Please select an interview time.
            </div>
        `;

        return;
    }

    saveButton.disabled = true;

    saveButton.textContent =
        "Saving...";

    message.innerHTML = "";

    try {

        const response =
            await fetch(
                `${API_URL}/jobs/${jobId}/candidates/${candidateId}/interview`,
                {
                    method: "PATCH",

                    headers: {
                        "Content-Type":
                            "application/json",

                        Authorization:
                            `Bearer ${token}`
                    },

                    body: JSON.stringify({

                        interview_date:
                            dateInput.value,

                        interview_time:
                            timeInput.value,

                        interview_type:
                            typeInput.value,

                        interviewer:
                            interviewerInput.value.trim(),

                        interview_status:
                            statusInput.value,

                        interview_notes:
                            notesInput.value.trim()

                    })
                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            message.innerHTML = `
                <div class="message error">
                    ${escapeHtml(
                        data.detail ||
                        "Could not save interview details."
                    )}
                </div>
            `;

            return;
        }

        message.innerHTML = `
            <div class="message success">
                Interview details saved successfully.
            </div>
        `;

        const candidateIndex =
            allCandidates.findIndex(
                candidate =>
                    candidate.id === candidateId
            );

        if (candidateIndex !== -1) {

    allCandidates[candidateIndex].interview_date =
        data.interview_date;

    allCandidates[candidateIndex].interview_time =
        data.interview_time;

    allCandidates[candidateIndex].interview_type =
        data.interview_type;

    allCandidates[candidateIndex].interviewer =
        data.interviewer;

    allCandidates[candidateIndex].interview_status =
        data.interview_status;

    allCandidates[candidateIndex].interview_notes =
        data.interview_notes;
}

applyCandidateFilters();

    } catch (error) {

        console.error(
            "Interview save error:",
            error
        );

        message.innerHTML = `
            <div class="message error">
                Could not connect to the backend.
            </div>
        `;

    } finally {

        saveButton.disabled = false;

        saveButton.textContent =
            "Save Interview Details";
    }
}

function addInterviewManagement(candidate) {

    const panel =
        document.querySelector(
            "#candidateReviewModal .candidate-review-panel"
        );

    if (!panel) {
        return;
    }

    const existingSection =
        document.getElementById(
            "interviewManagementSection"
        );

    if (existingSection) {
        return;
    }

    const section =
        document.createElement("div");

    section.id =
        "interviewManagementSection";

    section.className =
        "review-interview-management";

    section.innerHTML = `

        <div class="review-interview-header">

            <span class="review-section-title">
                Interview Management
            </span>

            <p class="review-notes-description">
                Schedule and manage the candidate interview.
            </p>

        </div>


        <div class="interview-form-grid">

            <div class="interview-form-group">

                <label for="interviewDate">
                    Interview Date
                </label>

                <input
                    type="date"
                    id="interviewDate"
                    value="${escapeHtml(
                        candidate.interview_date || ""
                    )}"
                >

            </div>


            <div class="interview-form-group">

                <label for="interviewTime">
                    Interview Time
                </label>

                <input
                    type="time"
                    id="interviewTime"
                    value="${escapeHtml(
                        candidate.interview_time || ""
                    )}"
                >

            </div>


            <div class="interview-form-group">

                <label for="interviewType">
                    Interview Type
                </label>

                <select id="interviewType">

                    <option
                        value="online"
                        ${
                            candidate.interview_type === "online"
                                ? "selected"
                                : ""
                        }
                    >
                        Online
                    </option>

                    <option
                        value="in-person"
                        ${
                            candidate.interview_type === "in-person"
                                ? "selected"
                                : ""
                        }
                    >
                        In-person
                    </option>

                    <option
                        value="phone"
                        ${
                            candidate.interview_type === "phone"
                                ? "selected"
                                : ""
                        }
                    >
                        Phone
                    </option>

                </select>

            </div>


            <div class="interview-form-group">

                <label for="interviewer">
                    Interviewer
                </label>

                <input
                    type="text"
                    id="interviewer"
                    placeholder="Enter interviewer name"
                    value="${escapeHtml(
                        candidate.interviewer || ""
                    )}"
                >

            </div>


            <div class="interview-form-group">

                <label for="interviewStatus">
                    Interview Status
                </label>

                <select id="interviewStatus">

                    <option
                        value="scheduled"
                        ${
                            candidate.interview_status === "scheduled"
                                ? "selected"
                                : ""
                        }
                    >
                        Scheduled
                    </option>

                    <option
                        value="completed"
                        ${
                            candidate.interview_status === "completed"
                                ? "selected"
                                : ""
                        }
                    >
                        Completed
                    </option>

                    <option
                        value="cancelled"
                        ${
                            candidate.interview_status === "cancelled"
                                ? "selected"
                                : ""
                        }
                    >
                        Cancelled
                    </option>

                </select>

            </div>

        </div>


        <div class="interview-form-group interview-notes-group">

            <label for="interviewNotes">
                Interview Notes
            </label>

            <textarea
                id="interviewNotes"
                placeholder="Add interview notes, observations, or follow-up details..."
            >${escapeHtml(
                candidate.interview_notes || ""
            )}</textarea>

        </div>


        <div
            id="interviewManagementMessage"
            class="notes-message"
        ></div>


        <button
            type="button"
            class="save-interview-button"
            id="saveInterviewButton"
            onclick="saveInterviewDetails(${candidate.id})"
        >
            Save Interview Details
        </button>

    `;

    panel.appendChild(section);
}