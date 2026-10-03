import sqlite3


from pathlib import Path

DATABASE = str(
    Path(__file__).resolve().parent.parent / "resumeiq.db"
)


def get_connection():
    connection = sqlite3.connect(
        DATABASE,
        check_same_thread=False
    )

    connection.row_factory = sqlite3.Row

    return connection


def init_database():

    connection = get_connection()

    cursor = connection.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'candidate',
            free_credits INTEGER DEFAULT 5,
            paid_balance REAL DEFAULT 0,
            total_analyses INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS analysis_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            analysis_type TEXT NOT NULL,
            file_name TEXT,
            score INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            recruiter_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            company TEXT NOT NULL,
            location TEXT,
            experience TEXT,
            description TEXT NOT NULL,
            status TEXT DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (recruiter_id) REFERENCES users(id)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS job_candidates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_id INTEGER NOT NULL,
            candidate_name TEXT,
            candidate_email TEXT,
            resume_filename TEXT NOT NULL,
            resume_path TEXT,
            match_score INTEGER,
            skills_match INTEGER,
            experience_match INTEGER,
            education_match INTEGER,
            matched_skills TEXT,
            missing_skills TEXT,
            status TEXT DEFAULT 'review',
            notes TEXT,
            interview_questions TEXT,
            interview_date TEXT,
            interview_time TEXT,
            interview_type TEXT,
            interviewer TEXT,
            interview_status TEXT,
            interview_notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (job_id) REFERENCES jobs(id)
        )
    """)

    cursor.execute(
        "PRAGMA table_info(users)"
    )

    user_columns = [
        column["name"]
        for column in cursor.fetchall()
    ]

    if "role" not in user_columns:

        cursor.execute("""
            ALTER TABLE users
            ADD COLUMN role TEXT DEFAULT 'candidate'
        """)

    cursor.execute(
        "PRAGMA table_info(jobs)"
    )

    job_columns = [
        column["name"]
        for column in cursor.fetchall()
    ]

    required_job_columns = {
        "recruiter_id": "INTEGER",
        "title": "TEXT",
        "company": "TEXT",
        "location": "TEXT",
        "experience": "TEXT",
        "description": "TEXT",
        "status": "TEXT",
        "created_at": "TIMESTAMP"
    }

    for column_name, column_type in required_job_columns.items():

        if column_name not in job_columns:

            cursor.execute(
                f"""
                ALTER TABLE jobs
                ADD COLUMN {column_name} {column_type}
                """
            )

    cursor.execute(
        "PRAGMA table_info(job_candidates)"
    )

    candidate_columns = [
        column["name"]
        for column in cursor.fetchall()
    ]

    required_candidate_columns = {
        "job_id": "INTEGER",
        "candidate_name": "TEXT",
        "candidate_email": "TEXT",
        "resume_filename": "TEXT",
        "resume_path": "TEXT",
        "match_score": "INTEGER",
        "skills_match": "INTEGER",
        "experience_match": "INTEGER",
        "education_match": "INTEGER",
        "matched_skills": "TEXT",
        "missing_skills": "TEXT",
        "status": "TEXT",
        "notes": "TEXT",
        "interview_questions": "TEXT",
        "interview_date": "TEXT",
        "interview_time": "TEXT",
        "interview_type": "TEXT",
        "interviewer": "TEXT",
        "interview_status": "TEXT",
        "interview_notes": "TEXT",
        "created_at": "TIMESTAMP"
    }

    for column_name, column_type in required_candidate_columns.items():

        if column_name not in candidate_columns:

            cursor.execute(
                f"""
                ALTER TABLE job_candidates
                ADD COLUMN {column_name} {column_type}
                """
            )

    connection.commit()

    connection.close()


def create_user(
    name,
    email,
    password,
    role="candidate"
):

    connection = get_connection()

    cursor = connection.cursor()

    cursor.execute(
        """
        INSERT INTO users
        (
            name,
            email,
            password,
            role,
            free_credits,
            paid_balance
        )
        VALUES (?, ?, ?, ?, 5, 0)
        """,
        (
            name,
            email,
            password,
            role
        )
    )

    connection.commit()

    user_id = cursor.lastrowid

    connection.close()

    return user_id


def get_user_by_email(email):

    connection = get_connection()

    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT *
        FROM users
        WHERE email = ?
        """,
        (email,)
    )

    user = cursor.fetchone()

    connection.close()

    return user


def get_user_by_id(user_id):

    connection = get_connection()

    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT *
        FROM users
        WHERE id = ?
        """,
        (user_id,)
    )

    user = cursor.fetchone()

    connection.close()

    return user


def consume_analysis(user_id):

    connection = get_connection()

    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT
            free_credits,
            paid_balance
        FROM users
        WHERE id = ?
        """,
        (user_id,)
    )

    user = cursor.fetchone()

    if not user:

        connection.close()

        return {
            "allowed": False,
            "reason": "User not found"
        }

    free_credits = user["free_credits"]
    paid_balance = user["paid_balance"]

    if free_credits > 0:

        cursor.execute(
            """
            UPDATE users
            SET
                free_credits = free_credits - 1,
                total_analyses = total_analyses + 1
            WHERE id = ?
            """,
            (user_id,)
        )

        connection.commit()
        connection.close()

        return {
            "allowed": True,
            "charged": 0,
            "free_used": True,
            "remaining_free": free_credits - 1
        }

    if paid_balance >= 10:

        cursor.execute(
            """
            UPDATE users
            SET
                paid_balance = paid_balance - 10,
                total_analyses = total_analyses + 1
            WHERE id = ?
            """,
            (user_id,)
        )

        connection.commit()
        connection.close()

        return {
            "allowed": True,
            "charged": 10,
            "free_used": False,
            "remaining_balance": paid_balance - 10
        }

    connection.close()

    return {
        "allowed": False,
        "charged": 10,
        "reason": "Payment required"
    }


def save_analysis_history(
    user_id,
    analysis_type,
    file_name,
    score
):

    connection = get_connection()

    cursor = connection.cursor()

    cursor.execute(
        """
        INSERT INTO analysis_history
        (
            user_id,
            analysis_type,
            file_name,
            score
        )
        VALUES (?, ?, ?, ?)
        """,
        (
            user_id,
            analysis_type,
            file_name,
            score
        )
    )

    connection.commit()

    history_id = cursor.lastrowid

    connection.close()

    return history_id


def get_analysis_history(user_id):

    connection = get_connection()

    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT
            id,
            analysis_type,
            file_name,
            score,
            created_at
        FROM analysis_history
        WHERE user_id = ?
        ORDER BY created_at DESC
        """,
        (user_id,)
    )

    history = cursor.fetchall()

    connection.close()

    return history


def create_job(
    recruiter_id,
    title,
    company,
    location,
    experience,
    description
):

    connection = get_connection()

    cursor = connection.cursor()

    cursor.execute(
        """
        INSERT INTO jobs
        (
            recruiter_id,
            title,
            company,
            location,
            experience,
            description
        )
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            recruiter_id,
            title,
            company,
            location,
            experience,
            description
        )
    )

    connection.commit()

    job_id = cursor.lastrowid

    connection.close()

    return job_id


def get_jobs_by_recruiter(recruiter_id):

    connection = get_connection()

    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT
            id,
            recruiter_id,
            title,
            company,
            location,
            experience,
            description,
            status,
            created_at
        FROM jobs
        WHERE recruiter_id = ?
        ORDER BY created_at DESC
        """,
        (recruiter_id,)
    )

    jobs = cursor.fetchall()

    connection.close()

    return jobs


def get_job_by_id(
    job_id,
    recruiter_id
):

    connection = get_connection()

    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT
            id,
            recruiter_id,
            title,
            company,
            location,
            experience,
            description,
            status,
            created_at
        FROM jobs
        WHERE id = ?
        AND recruiter_id = ?
        """,
        (
            job_id,
            recruiter_id
        )
    )

    job = cursor.fetchone()

    connection.close()

    return job


def delete_job(
    job_id,
    recruiter_id
):

    connection = get_connection()

    cursor = connection.cursor()

    cursor.execute(
        """
        DELETE FROM jobs
        WHERE id = ?
        AND recruiter_id = ?
        """,
        (
            job_id,
            recruiter_id
        )
    )

    connection.commit()

    deleted = cursor.rowcount > 0

    connection.close()

    return deleted

def update_job(
    job_id,
    recruiter_id,
    title,
    company,
    location,
    experience,
    description
):
    connection = get_connection()

    cursor = connection.cursor()

    cursor.execute(
        """
        UPDATE jobs
        SET
            title = ?,
            company = ?,
            location = ?,
            experience = ?,
            description = ?
        WHERE id = ?
        AND recruiter_id = ?
        """,
        (
            title,
            company,
            location,
            experience,
            description,
            job_id,
            recruiter_id
        )
    )

    connection.commit()

    updated = cursor.rowcount > 0

    connection.close()

    return updated

def create_job_candidate(
    job_id,
    candidate_name,
    candidate_email,
    resume_filename,
    resume_path=""
):

    connection = get_connection()

    cursor = connection.cursor()

    cursor.execute(
        """
        INSERT INTO job_candidates
        (
            job_id,
            candidate_name,
            candidate_email,
            resume_filename,
            resume_path
        )
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            job_id,
            candidate_name,
            candidate_email,
            resume_filename,
            resume_path
        )
    )

    connection.commit()

    candidate_id = cursor.lastrowid

    connection.close()

    return candidate_id


def get_job_candidates(job_id):

    connection = get_connection()

    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT *
        FROM job_candidates
        WHERE job_id = ?
        ORDER BY created_at DESC
        """,
        (job_id,)
    )

    candidates = cursor.fetchall()

    connection.close()

    return candidates


def get_job_candidate_by_id(
    candidate_id,
    job_id
):

    connection = get_connection()

    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT *
        FROM job_candidates
        WHERE id = ?
        AND job_id = ?
        """,
        (
            candidate_id,
            job_id
        )
    )

    candidate = cursor.fetchone()

    connection.close()

    return candidate


def get_job_candidate_by_filename(
    job_id,
    resume_filename
):

    connection = get_connection()

    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT *
        FROM job_candidates
        WHERE job_id = ?
        AND resume_filename = ?
        """,
        (
            job_id,
            resume_filename
        )
    )

    candidate = cursor.fetchone()

    connection.close()

    return candidate


def update_job_candidate_status(
    candidate_id,
    status
):

    connection = get_connection()

    cursor = connection.cursor()

    cursor.execute(
        """
        UPDATE job_candidates
        SET status = ?
        WHERE id = ?
        """,
        (
            status,
            candidate_id
        )
    )

    connection.commit()

    connection.close()


def update_job_candidate_screening(
    candidate_id,
    match_score,
    skills_match,
    experience_match,
    education_match,
    matched_skills,
    missing_skills
):

    connection = get_connection()

    cursor = connection.cursor()

    cursor.execute(
        """
        UPDATE job_candidates
        SET
            match_score = ?,
            skills_match = ?,
            experience_match = ?,
            education_match = ?,
            matched_skills = ?,
            missing_skills = ?
        WHERE id = ?
        """,
        (
            match_score,
            skills_match,
            experience_match,
            education_match,
            matched_skills,
            missing_skills,
            candidate_id
        )
    )

    connection.commit()

    connection.close()


def update_job_candidate_notes(
    candidate_id,
    notes
):

    connection = get_connection()

    cursor = connection.cursor()

    cursor.execute(
        """
        UPDATE job_candidates
        SET notes = ?
        WHERE id = ?
        """,
        (
            notes,
            candidate_id
        )
    )

    connection.commit()

    connection.close()


def update_job_candidate_interview_questions(
    candidate_id,
    interview_questions
):

    connection = get_connection()

    cursor = connection.cursor()

    cursor.execute(
        """
        UPDATE job_candidates
        SET interview_questions = ?
        WHERE id = ?
        """,
        (
            interview_questions,
            candidate_id
        )
    )

    connection.commit()

    connection.close()


def update_job_candidate_interview(
    candidate_id,
    interview_date,
    interview_time,
    interview_type,
    interviewer,
    interview_status,
    interview_notes
):

    connection = get_connection()

    cursor = connection.cursor()

    cursor.execute(
        """
        UPDATE job_candidates
        SET
            interview_date = ?,
            interview_time = ?,
            interview_type = ?,
            interviewer = ?,
            interview_status = ?,
            interview_notes = ?
        WHERE id = ?
        """,
        (
            interview_date,
            interview_time,
            interview_type,
            interviewer,
            interview_status,
            interview_notes,
            candidate_id
        )
    )

    connection.commit()

    connection.close()