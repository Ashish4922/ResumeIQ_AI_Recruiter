const API_URL = "http://127.0.0.1:8000";

const token = localStorage.getItem("token");

const userName =
    document.getElementById("userName");

const logoutBtn =
    document.getElementById("logoutBtn");

const createJobBtn =
    document.getElementById("createJobBtn");

const emptyCreateJobBtn =
    document.getElementById("emptyCreateJobBtn");

const closeJobBtn =
    document.getElementById("closeJobBtn");

const cancelJobBtn =
    document.getElementById("cancelJobBtn");

const createJobSection =
    document.getElementById("createJobSection");

const jobForm =
    document.getElementById("jobForm");

const jobMessage =
    document.getElementById("jobMessage");

const jobsContainer =
    document.getElementById("jobsContainer");

const activeJobsCount =
    document.getElementById("activeJobsCount");

const totalCandidates =
    document.getElementById("totalCandidates");

const shortlistedCandidates =
    document.getElementById("shortlistedCandidates");

const interviews =
    document.getElementById("interviews");

const rejectedCandidates =
    document.getElementById("rejectedCandidates");

const averageMatchScore =
    document.getElementById("averageMatchScore");


if (!token) {

    window.location.href =
        "login.html";

}


async function loadRecruiter() {

    try {

        const response =
            await fetch(
                `${API_URL}/me`,
                {
                    headers: {
                        Authorization:
                            `Bearer ${token}`
                    }
                }
            );

        if (!response.ok) {

            logout();

            return;

        }

        const user =
            await response.json();

        if (user.role !== "recruiter") {

            window.location.href =
                "index.html";

            return;

        }

        userName.textContent =
            user.name;

        await loadJobs();

    }

    catch (error) {

        console.error(
            "Could not load recruiter:",
            error
        );

    }

}


async function loadJobs() {

    try {

        const response =
            await fetch(
                `${API_URL}/jobs`,
                {
                    headers: {
                        Authorization:
                            `Bearer ${token}`
                    }
                }
            );

        if (!response.ok) {

            return;

        }

        const data =
            await response.json();

        const jobs =
            Array.isArray(data.jobs)
                ? data.jobs
                : [];

        /*
         * Render the jobs immediately.
         *
         * The job list is the primary dashboard content.
         * Statistics and upcoming interviews use additional
         * candidate requests, so an error or delay in those
         * requests must not prevent the jobs from being displayed.
         */
        await renderJobs(
            jobs
        );

        /*
         * Load dashboard statistics separately.
         * A statistics error must not hide the job cards.
         */
        try {

            await updateDashboardStats(
                jobs
            );

        }

        catch (error) {

            console.error(
                "Could not update dashboard statistics:",
                error
            );

        }

        /*
         * Load upcoming interviews separately.
         * An interview-loading error must not hide the job cards.
         */
        try {

            await loadUpcomingInterviews(
                jobs
            );

        }

        catch (error) {

            console.error(
                "Could not load upcoming interviews:",
                error
            );

        }

    }

    catch (error) {

        console.error(
            "Could not load jobs:",
            error
        );

    }

}


async function getJobCandidates(
    jobId
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

        if (!response.ok) {

            return [];

        }

        const data =
            await response.json();

        return data.candidates || [];

    }

    catch (error) {

        console.error(
            `Could not load candidates for job ${jobId}:`,
            error
        );

        return [];

    }

}


async function updateDashboardStats(
    jobs
) {

    const activeJobs =
        jobs.filter(
            job =>
                job.status === "active"
        );

    activeJobsCount.textContent =
        activeJobs.length;

    let candidateTotal = 0;

    let shortlistedTotal = 0;

    let interviewTotal = 0;

    let rejectedTotal = 0;

    let scoreTotal = 0;

    let scoreCount = 0;


    const candidateResults =
        await Promise.all(
            jobs.map(
                async job => {

                    const candidates =
                        await getJobCandidates(
                            job.id
                        );

                    return {
                        job,
                        candidates
                    };

                }
            )
        );


    candidateResults.forEach(
        result => {

            const candidates =
                result.candidates;

            candidateTotal +=
                candidates.length;

            shortlistedTotal +=
                candidates.filter(
                    candidate =>
                        candidate.status ===
                        "shortlisted"
                ).length;

            interviewTotal +=
                candidates.filter(
                    candidate =>
                        candidate.status ===
                        "interview"
                ).length;

            rejectedTotal +=
                candidates.filter(
                    candidate =>
                        candidate.status ===
                        "rejected"
                ).length;


            candidates.forEach(
                candidate => {

                    const score =
                        Number(
                            candidate.match_score
                        );

                    if (
                        Number.isFinite(score)
                    ) {

                        scoreTotal +=
                            score;

                        scoreCount++;

                    }

                }
            );

        }
    );


    totalCandidates.textContent =
        candidateTotal;

    shortlistedCandidates.textContent =
        shortlistedTotal;

    interviews.textContent =
        interviewTotal;

    rejectedCandidates.textContent =
        rejectedTotal;


    if (scoreCount > 0) {

        const average =
            Math.round(
                scoreTotal /
                scoreCount
            );

        averageMatchScore.textContent =
            `${average}%`;

    }

    else {

        averageMatchScore.textContent =
            "-";

    }

}


async function renderJobs(
    jobs
) {

    if (jobs.length === 0) {

        jobsContainer.innerHTML = `

            <div class="empty-state">

                <div class="empty-icon">
                    💼
                </div>

                <h3>
                    No Jobs Created Yet
                </h3>

                <p>
                    Create your first job to start
                    screening candidates.
                </p>

                <button
                    class="primary-button"
                    id="emptyCreateJobBtnNew">

                    Create Your First Job

                </button>

            </div>

        `;


        const button =
            document.getElementById(
                "emptyCreateJobBtnNew"
            );


        if (button) {

            button.addEventListener(
                "click",
                showCreateJob
            );

        }

        return;

    }


    /*
     * Render the job cards immediately.
     *
     * Candidate requests are additional data.
     * They must not block the job list from appearing.
     */
    const initialResults =
        jobs.map(
            job => ({
                job,
                candidates: []
            })
        );


    renderJobCards(
        initialResults
    );


    /*
     * Load candidate data in the background.
     *
     * Once candidate information is available,
     * refresh the analytics shown on each job card.
     */
    try {

        const jobResults =
            await Promise.all(
                jobs.map(
                    async job => {

                        const candidates =
                            await getJobCandidates(
                                job.id
                            );


                        return {
                            job,
                            candidates
                        };

                    }
                )
            );


        renderJobCards(
            jobResults
        );

    }

    catch (error) {

        console.error(
            "Could not load candidate data for jobs:",
            error
        );

    }

}

function renderJobCards(
    jobResults
) {

    jobsContainer.innerHTML =
        jobResults.map(
            result => {

                const job =
                    result.job;

                const candidates =
                    result.candidates || [];


                const shortlisted =
                    candidates.filter(
                        candidate =>
                            candidate.status ===
                            "shortlisted"
                    ).length;


                const interview =
                    candidates.filter(
                        candidate =>
                            candidate.status ===
                            "interview"
                    ).length;


                const scores =
                    candidates
                        .map(
                            candidate =>
                                Number(
                                    candidate.match_score
                                )
                        )
                        .filter(
                            score =>
                                Number.isFinite(
                                    score
                                )
                        );


                let averageScore = "-";


                if (
                    scores.length > 0
                ) {

                    const total =
                        scores.reduce(
                            (
                                sum,
                                score
                            ) =>
                                sum + score,
                            0
                        );


                    averageScore =
                        `${Math.round(
                            total /
                            scores.length
                        )}%`;

                }


                return `

                    <div class="job-card">

                        <div class="job-card-header">

                            <div>

                                <h3>
                                    ${escapeHtml(
                                        job.title
                                    )}
                                </h3>

                                <p class="job-company">
                                    ${escapeHtml(
                                        job.company
                                    )}
                                </p>

                            </div>


                            <span class="job-status">

                                ${escapeHtml(
                                    job.status ||
                                    "active"
                                )}

                            </span>

                        </div>


                        <div class="job-details">

                            <span>

                                📍

                                ${escapeHtml(
                                    job.location ||
                                    "Remote"
                                )}

                            </span>


                            <span>

                                💼

                                ${escapeHtml(
                                    job.experience ||
                                    "Not specified"
                                )}

                            </span>

                        </div>


                        <p class="job-description">

                            ${escapeHtml(
                                job.description
                            )}

                        </p>


                        <div class="job-analytics">

                            <div class="job-stat">

                                <span>
                                    Candidates
                                </span>

                                <strong>
                                    ${candidates.length}
                                </strong>

                            </div>


                            <div class="job-stat">

                                <span>
                                    Shortlisted
                                </span>

                                <strong>
                                    ${shortlisted}
                                </strong>

                            </div>


                            <div class="job-stat">

                                <span>
                                    Interviews
                                </span>

                                <strong>
                                    ${interview}
                                </strong>

                            </div>


                            <div class="job-stat">

                                <span>
                                    Avg Match
                                </span>

                                <strong>
                                    ${averageScore}
                                </strong>

                            </div>

                        </div>


                        <div class="job-card-footer">

                            <span>

                                Created:

                                ${formatDate(
                                    job.created_at
                                )}

                            </span>


                            <div class="job-actions">

                                <button
                                    class="primary-button small-button"
                                    onclick="viewCandidates(${job.id})">

                                    View Candidates

                                </button>


                                <button
                                    class="secondary-button small-button"
                                    onclick="downloadJobReport(${job.id})">

                                    Download Report

                                </button>


                                <button
                                    class="secondary-button small-button"
                                    onclick="editJob(${job.id})">

                                    Edit

                                </button>


                                <button
                                    class="secondary-button small-button"
                                    onclick="deleteJob(${job.id})">

                                    Delete

                                </button>

                            </div>

                        </div>

                    </div>

                `;

            }
        ).join("");

}

function viewCandidates(
    jobId
) {

    window.location.href =
        `candidates.html?job_id=${jobId}`;

}

async function downloadJobReport(jobId) {

    try {

        const response = await fetch(
            `${API_URL}/jobs/${jobId}/report`,
            {
                headers: {
                    Authorization:
                        `Bearer ${token}`
                }
            }
        );


        if (!response.ok) {

            let message =
                "Could not download report.";

            try {

                const data =
                    await response.json();

                message =
                    data.detail || message;

            }
            catch (error) {
                // Ignore JSON parsing error
            }

            alert(message);

            return;
        }


        const blob =
            await response.blob();


        const url =
            window.URL.createObjectURL(blob);


        const link =
            document.createElement("a");


        link.href = url;

        link.download =
            `ResumeIQ_Job_${jobId}_Report.csv`;


        document.body.appendChild(link);

        link.click();

        link.remove();


        window.URL.revokeObjectURL(url);

    }

    catch (error) {

        console.error(
            "Could not download report:",
            error
        );

        alert(
            "Could not connect to the backend."
        );

    }

}


async function editJob(
    jobId
) {

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
                "Could not load job details."
            );

            return;

        }


        const job =
            data.job;


        if (!job) {

            alert(
                "Job details could not be loaded."
            );

            return;

        }


        document.getElementById(
            "jobTitle"
        ).value =
            job.title || "";


        document.getElementById(
            "jobCompany"
        ).value =
            job.company || "";


        document.getElementById(
            "jobLocation"
        ).value =
            job.location || "";


        document.getElementById(
            "jobExperience"
        ).value =
            job.experience || "";


        document.getElementById(
            "jobDescription"
        ).value =
            job.description || "";


        jobForm.dataset.editingJobId =
            String(jobId);


        const submitButton =
            jobForm.querySelector(
                'button[type="submit"]'
            );


        if (submitButton) {

            submitButton.textContent =
                "Update Job";

        }


        showCreateJob();

    }

    catch (error) {

        console.error(
            "Could not load job:",
            error
        );

        alert(
            "Could not connect to the backend."
        );

    }

}


function showCreateJob() {

    createJobSection.classList.remove(
        "hidden"
    );

    createJobSection.scrollIntoView({
        behavior: "smooth"
    });

}


function hideCreateJob() {

    createJobSection.classList.add(
        "hidden"
    );

    jobForm.reset();

    delete jobForm.dataset.editingJobId;


    const submitButton =
        jobForm.querySelector(
            'button[type="submit"]'
        );


    if (submitButton) {

        submitButton.textContent =
            "Create Job";

    }


    jobMessage.innerHTML = "";

}


function showMessage(
    text,
    type
) {

    jobMessage.innerHTML = "";


    const message =
        document.createElement(
            "div"
        );


    message.className =
        `message ${type}`;


    message.textContent =
        text;


    jobMessage.appendChild(
        message
    );

}


createJobBtn.addEventListener(
    "click",
    showCreateJob
);


emptyCreateJobBtn.addEventListener(
    "click",
    showCreateJob
);


closeJobBtn.addEventListener(
    "click",
    hideCreateJob
);


cancelJobBtn.addEventListener(
    "click",
    hideCreateJob
);


jobForm.addEventListener(
    "submit",
    async function(event) {

        event.preventDefault();


        const title =
            document
                .getElementById(
                    "jobTitle"
                )
                .value
                .trim();


        const company =
            document
                .getElementById(
                    "jobCompany"
                )
                .value
                .trim();


        const location =
            document
                .getElementById(
                    "jobLocation"
                )
                .value
                .trim();


        const experience =
            document
                .getElementById(
                    "jobExperience"
                )
                .value
                .trim();


        const description =
            document
                .getElementById(
                    "jobDescription"
                )
                .value
                .trim();


        const button =
            jobForm.querySelector(
                'button[type="submit"]'
            );


        const editingJobId =
            jobForm.dataset.editingJobId;


        const isEditing =
            Boolean(editingJobId);


        if (!title) {

            showMessage(
                "Job title is required.",
                "error"
            );

            return;

        }


        if (!company) {

            showMessage(
                "Company name is required.",
                "error"
            );

            return;

        }


        if (!description) {

            showMessage(
                "Job description is required.",
                "error"
            );

            return;

        }


        button.disabled = true;


        button.textContent =
            isEditing
                ? "Updating Job..."
                : "Creating Job...";


        jobMessage.innerHTML = "";


        try {

            const response =
                await fetch(
                    isEditing
                        ? `${API_URL}/jobs/${editingJobId}`
                        : `${API_URL}/jobs`,
                    {
                        method:
                            isEditing
                                ? "PATCH"
                                : "POST",

                        headers: {
                            "Content-Type":
                                "application/json",

                            Authorization:
                                `Bearer ${token}`
                        },

                        body:
                            JSON.stringify({
                                title:
                                    title,

                                company:
                                    company,

                                location:
                                    location,

                                experience:
                                    experience,

                                description:
                                    description
                            })
                    }
                );


            const data =
                await response.json();


            if (!response.ok) {

                showMessage(
                    data.detail ||
                    (
                        isEditing
                            ? "Could not update job."
                            : "Could not create job."
                    ),
                    "error"
                );

                return;

            }


            showMessage(
                isEditing
                    ? "Job updated successfully."
                    : "Job created successfully.",
                "success"
            );


            jobForm.reset();


            delete jobForm.dataset.editingJobId;


            await loadJobs();


            setTimeout(
                () => {

                    hideCreateJob();

                },
                800
            );

        }

        catch (error) {

            console.error(
                "Job form error:",
                error
            );


            showMessage(
                "Could not connect to the backend.",
                "error"
            );

        }

        finally {

            button.disabled = false;


            button.textContent =
                "Create Job";

        }

    }
);


async function deleteJob(
    jobId
) {

    const confirmed =
        confirm(
            "Are you sure you want to delete this job?"
        );


    if (!confirmed) {

        return;

    }


    try {

        const response =
            await fetch(
                `${API_URL}/jobs/${jobId}`,
                {
                    method: "DELETE",

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
                "Could not delete job."
            );

            return;

        }


        await loadJobs();

    }

    catch (error) {

        console.error(
            "Could not delete job:",
            error
        );


        alert(
            "Could not connect to the backend."
        );

    }

}


function escapeHtml(
    value
) {

    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        value || "";


    return div.innerHTML;

}


function formatDate(
    value
) {

    if (!value) {

        return "";

    }


    const date =
        new Date(
            value.replace(
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


logoutBtn.addEventListener(
    "click",
    logout
);


async function loadUpcomingInterviews(jobs) {

    const container =
        document.getElementById(
            "upcomingInterviewsContainer"
        );

    if (!container) {
        return;
    }

    let upcomingInterviews = [];


    for (const job of jobs) {

        const candidates =
            await getJobCandidates(job.id);


        candidates.forEach(candidate => {

            if (
                candidate.interview_status === "scheduled" &&
                candidate.interview_date
            ) {

                upcomingInterviews.push({
                    ...candidate,

                    job_id: job.id,

                    job_title:
                        job.title || "Untitled Job",

                    company:
                        job.company || ""
                });

            }

        });

    }


    upcomingInterviews.sort(
        (a, b) => {

            const dateA =
                new Date(
                    `${a.interview_date}T${a.interview_time || "00:00"}`
                );

            const dateB =
                new Date(
                    `${b.interview_date}T${b.interview_time || "00:00"}`
                );

            return dateA - dateB;

        }
    );


    if (upcomingInterviews.length === 0) {

        container.innerHTML = `

            <div class="empty-state">

                <div class="empty-icon">
                    📅
                </div>

                <h3>
                    No Upcoming Interviews
                </h3>

                <p>
                    Scheduled interviews will appear here.
                </p>

            </div>

        `;

        return;
    }


    container.innerHTML =
        upcomingInterviews.map(
            interview => {

                const interviewDate =
                    new Date(
                        `${interview.interview_date}T${interview.interview_time || "00:00"}`
                    );


                const day =
                    interviewDate.toLocaleDateString(
                        "en-IN",
                        {
                            day: "numeric"
                        }
                    );


                const month =
                    interviewDate.toLocaleDateString(
                        "en-IN",
                        {
                            month: "short"
                        }
                    );


                const formattedDate =
                    interviewDate.toLocaleDateString(
                        "en-IN",
                        {
                            day: "numeric",
                            month: "short",
                            year: "numeric"
                        }
                    );


                const time =
                    interview.interview_time ||
                    "Time not set";


                const interviewType =
                    interview.interview_type
                        ? interview.interview_type
                            .replace(
                                /^./,
                                character =>
                                    character.toUpperCase()
                            )
                        : "Online";


                const interviewer =
                    interview.interviewer ||
                    "Not assigned";


                return `

                    <div class="interview-card">

                        <div class="interview-card-main">


                            <div class="interview-date-box">

                                <span
                                    class="interview-day"
                                >
                                    ${day}
                                </span>

                                <span
                                    class="interview-month"
                                >
                                    ${month}
                                </span>

                            </div>


                            <div class="interview-info">

                                <h3>
                                    ${escapeHtml(
                                        interview.candidate_name ||
                                        "Candidate"
                                    )}
                                </h3>


                                <p class="interview-job">

                                    ${escapeHtml(
                                        interview.job_title
                                    )}

                                    ${
                                        interview.company
                                            ? ` · ${escapeHtml(
                                                interview.company
                                            )}`
                                            : ""
                                    }

                                </p>


                                <div
                                    class="interview-meta"
                                >

                                    <span>

                                        📅

                                        ${formattedDate}

                                    </span>


                                    <span>

                                        🕐

                                        ${escapeHtml(
                                            time
                                        )}

                                    </span>


                                    <span>

                                        💻

                                        ${escapeHtml(
                                            interviewType
                                        )}

                                    </span>


                                    <span>

                                        👤

                                        ${escapeHtml(
                                            interviewer
                                        )}

                                    </span>

                                </div>

                            </div>

                        </div>


                        <div
                            class="interview-card-actions"
                        >

                            <span
                                class="interview-status-badge"
                            >
                                Scheduled
                            </span>


                            <button
                                class="view-interview-btn"
                                onclick="
                                    window.location.href =
                                    'candidates.html?job_id=${interview.job_id}'
                                "
                            >
                                View Candidate
                            </button>

                        </div>

                    </div>

                `;

            }
        ).join("");

}

loadRecruiter();