import os
import time
import tempfile
from pathlib import Path

from google import genai
from google.genai import types
from pydantic import BaseModel
from pypdf import PdfReader
from docx import Document
from PIL import Image

from dotenv import load_dotenv


ENV_FILE = Path(__file__).resolve().parent.parent / ".env"

load_dotenv(ENV_FILE)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY was not found in .env")


MODEL = "gemini-3.8-flash"

FALLBACK_MODELS = [
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite"
]


client = genai.Client(
    api_key=GEMINI_API_KEY
)


class Candidate(BaseModel):
    name: str
    email: str
    phone: str
    location: str
    education: list[str]
    experience: list[str]
    technical_skills: list[str]
    soft_skills: list[str]
    projects: list[str]
    certifications: list[str]


class ResumeQuality(BaseModel):
    score: int
    strengths: list[str]
    weaknesses: list[str]
    suggestions: list[str]


class ATSAnalysis(BaseModel):
    score: int
    issues: list[str]
    keywords_found: list[str]
    missing_keywords: list[str]
    suggestions: list[str]


class SkillUpgrade(BaseModel):
    skill: str
    reason: str
    priority: str


class ResumeAnalysis(BaseModel):
    candidate: Candidate
    resume_quality: ResumeQuality
    ats_analysis: ATSAnalysis
    skill_upgrades: list[SkillUpgrade]


class JobMatchAnalysis(BaseModel):
    match_score: int
    skills_match: int
    experience_match: int
    education_match: int
    summary: str
    matched_skills: list[str]
    missing_skills: list[str]
    matched_requirements: list[str]
    missing_requirements: list[str]
    recommendations: list[str]
    skill_upgrades: list[SkillUpgrade]


class InterviewQuestionsAnalysis(BaseModel):
    questions: list[str]


def extract_pdf_text(file_path):
    reader = PdfReader(file_path)

    text = []

    for page in reader.pages:
        page_text = page.extract_text()

        if page_text:
            text.append(page_text)

    return "\n".join(text)


def extract_docx_text(file_path):
    document = Document(file_path)

    paragraphs = []

    for paragraph in document.paragraphs:
        if paragraph.text.strip():
            paragraphs.append(paragraph.text)

    return "\n".join(paragraphs)


def extract_txt_text(file_path):
    return Path(file_path).read_text(
        encoding="utf-8",
        errors="ignore"
    )


def build_prompt(resume_text):
    return f"""
You are an expert resume analyst and ATS evaluator.

Analyze the following resume carefully.

Extract factual information only from the resume.

Do not invent:
- education
- employment
- skills
- projects
- certifications
- contact details

If a field is not present, return an empty string or empty list.

Evaluate the resume for:
1. Candidate information
2. Education
3. Experience
4. Technical skills
5. Soft skills
6. Projects
7. Certifications
8. Resume quality
9. ATS compatibility
10. Missing keywords or sections
11. Skills the candidate should learn or improve

For skill upgrades, recommend skills based on:
- the candidate's existing technical profile
- modern software/technology roles
- skills that would make the resume stronger

Do not claim that a skill is required for a specific job because no job description was provided.

Resume:

{resume_text}
"""


def build_job_match_prompt(resume_text, job_description):
    return f"""
You are an expert recruitment and ATS analyst.

Compare the candidate resume with the provided job description.

Use only factual information available in the resume and job description.

Do not invent:
- skills
- experience
- education
- projects
- certifications
- job requirements

Calculate a match score from 0 to 100 based on how well the candidate's resume matches the job description.

Analyze:

1. Overall job match score from 0 to 100
2. Skills match score from 0 to 100
3. Experience match score from 0 to 100
4. Education match score from 0 to 100
5. Short summary of the match
6. Skills present in both resume and job description
7. Skills required by the job but missing from the resume
8. Job requirements that the candidate appears to satisfy
9. Job requirements that are not satisfied or not demonstrated
10. Practical recommendations for improving the resume for this job
11. Skills the candidate should learn or improve

For the scores:
- Use only evidence from the resume and job description.
- Do not invent experience or qualifications.
- If education requirements are not mentioned in the job description, use 100 only when the resume has relevant education evidence; otherwise use 0.
- If experience requirements are not mentioned in the job description, base the score on demonstrated relevant experience and clearly reflect the lack of evidence.

RESUME:

{resume_text}

JOB DESCRIPTION:

{job_description}
"""


def build_interview_questions_prompt(
    resume_text,
    job_description,
    matched_skills,
    missing_skills
):
    return f"""
You are an expert technical recruiter and interview preparation assistant.

Generate exactly 10 interview questions for the candidate based only on
the candidate's resume evidence and the provided job description.

Candidate Resume:

{resume_text}

Job Description:

{job_description}

Matched Skills:

{matched_skills}

Missing Skills:

{missing_skills}

Requirements:

1. Generate exactly 10 interview questions.
2. Include technical questions relevant to the job.
3. Include questions about projects, education, or experience that are
actually present in the resume.
4. Include questions that verify important matched skills.
5. Include questions that explore important missing or insufficiently
demonstrated skills.
6. Do not assume the candidate has experience, skills, projects,
certifications, or qualifications that are not present in the resume.
7. Do not provide answers.
8. Keep questions specific to this candidate and this job.
9. Mix technical, project-based, experience-based, and practical questions.
10. Return the questions as a JSON object containing a "questions" array.
"""


def generate_with_fallback(
    contents,
    response_schema=ResumeAnalysis
):
    last_error = None

    for model in [MODEL] + FALLBACK_MODELS:
        for attempt in range(2):
            try:
                config_args = {}

                if response_schema is not None:
                    config_args = {
                        "response_mime_type": "application/json",
                        "response_schema": response_schema
                    }

                response = client.models.generate_content(
                    model=model,
                    contents=contents,
                    config=types.GenerateContentConfig(
                        **config_args
                    )
                )

                return response

            except Exception as error:
                last_error = error

                error_text = str(error).upper()

                if (
                    "503" not in error_text
                    and
                    "429" not in error_text
                ):
                    raise

                if attempt == 0:
                    time.sleep(2)

    raise last_error


def analyze_resume(file_path, file_type):
    if file_type == "pdf":
        resume_text = extract_pdf_text(file_path)

        if not resume_text.strip():
            uploaded_file = client.files.upload(
                file=file_path
            )

            response = generate_with_fallback(
                [
                    build_prompt(
                        "Analyze the attached resume document."
                    ),
                    uploaded_file
                ]
            )

            return ResumeAnalysis.model_validate_json(
                response.text
            )

    elif file_type == "docx":
        resume_text = extract_docx_text(file_path)

    elif file_type == "txt":
        resume_text = extract_txt_text(file_path)

    elif file_type in ["png", "jpg", "jpeg"]:
        image = Image.open(file_path)

        response = generate_with_fallback(
            [
                build_prompt(
                    "Extract and analyze the resume shown in the attached image."
                ),
                image
            ]
        )

        return ResumeAnalysis.model_validate_json(
            response.text
        )

    else:
        raise ValueError(
            "Unsupported resume format."
        )

    if not resume_text.strip():
        raise ValueError(
            "Could not extract text from the resume."
        )

    response = generate_with_fallback(
        build_prompt(resume_text)
    )

    return ResumeAnalysis.model_validate_json(
        response.text
    )


def save_uploaded_file(uploaded_file):
    suffix = Path(
        uploaded_file.filename
    ).suffix.lower()

    temporary_file = tempfile.NamedTemporaryFile(
        delete=False,
        suffix=suffix
    )

    content = uploaded_file.file.read()

    temporary_file.write(content)
    temporary_file.close()

    return temporary_file.name


def analyze_job_match(
    file_path,
    file_type,
    job_description
):
    if file_type == "pdf":
        resume_text = extract_pdf_text(file_path)

        if not resume_text.strip():
            uploaded_file = client.files.upload(
                file=file_path
            )

            response = generate_with_fallback(
                [
                    build_job_match_prompt(
                        "Analyze the attached resume document.",
                        job_description
                    ),
                    uploaded_file
                ],
                response_schema=JobMatchAnalysis
            )

            return JobMatchAnalysis.model_validate_json(
                response.text
            )

    elif file_type == "docx":
        resume_text = extract_docx_text(file_path)

    elif file_type == "txt":
        resume_text = extract_txt_text(file_path)

    elif file_type in ["png", "jpg", "jpeg"]:
        image = Image.open(file_path)

        response = generate_with_fallback(
            [
                build_job_match_prompt(
                    "Extract and analyze the resume shown in the attached image.",
                    job_description
                ),
                image
            ],
            response_schema=JobMatchAnalysis
        )

        return JobMatchAnalysis.model_validate_json(
            response.text
        )

    else:
        raise ValueError(
            "Unsupported resume format."
        )

    if not resume_text.strip():
        raise ValueError(
            "Could not extract text from the resume."
        )

    response = generate_with_fallback(
        build_job_match_prompt(
            resume_text,
            job_description
        ),
        response_schema=JobMatchAnalysis
    )

    return JobMatchAnalysis.model_validate_json(
        response.text
    )


def generate_interview_questions(
    file_path,
    file_type,
    job_description,
    matched_skills,
    missing_skills
):
    if file_type == "pdf":
        resume_text = extract_pdf_text(file_path)

        if resume_text.strip():
            contents = build_interview_questions_prompt(
                resume_text,
                job_description,
                matched_skills,
                missing_skills
            )

        else:
            uploaded_file = client.files.upload(
                file=file_path
            )

            contents = [
                build_interview_questions_prompt(
                    "Analyze the attached resume document.",
                    job_description,
                    matched_skills,
                    missing_skills
                ),
                uploaded_file
            ]

    elif file_type == "docx":
        resume_text = extract_docx_text(file_path)

        if not resume_text.strip():
            raise ValueError(
                "Could not extract text from the resume."
            )

        contents = build_interview_questions_prompt(
            resume_text,
            job_description,
            matched_skills,
            missing_skills
        )

    elif file_type == "txt":
        resume_text = extract_txt_text(file_path)

        if not resume_text.strip():
            raise ValueError(
                "Could not extract text from the resume."
            )

        contents = build_interview_questions_prompt(
            resume_text,
            job_description,
            matched_skills,
            missing_skills
        )

    elif file_type in ["png", "jpg", "jpeg"]:
        image = Image.open(file_path)

        contents = [
            build_interview_questions_prompt(
                "Extract the candidate information from the attached resume image.",
                job_description,
                matched_skills,
                missing_skills
            ),
            image
        ]

    else:
        raise ValueError(
            "Unsupported resume format."
        )

    response = generate_with_fallback(
        contents,
        response_schema=InterviewQuestionsAnalysis
    )

    result = InterviewQuestionsAnalysis.model_validate_json(
        response.text
    )

    if len(result.questions) != 10:
        raise ValueError(
            "AI did not generate exactly 10 interview questions."
        )

    return result.questions
