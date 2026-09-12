#!/usr/bin/env python3
"""
Dominal Technology Jobs - Job Scraper Script
Uses JobSpy to retrieve recent job postings across LinkedIn, Indeed, and Glassdoor,
and serializes standardized job objects into frontend/data/jobs.json.
"""

import os
import json
import uuid
import datetime
from pathlib import Path

def run_scraper():
    print(f"[{datetime.datetime.now().isoformat()}] Starting Dominal Jobs scraper...")
    output_dir = Path(__file__).resolve().parent.parent / "frontend" / "data"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_file = output_dir / "jobs.json"

    # Existing jobs if available
    existing_jobs = []
    if output_file.exists():
        try:
            with open(output_file, "r", encoding="utf-8") as f:
                existing_jobs = json.load(f)
            print(f"Loaded {len(existing_jobs)} existing jobs.")
        except Exception as e:
            print(f"Notice reading existing jobs: {e}")

    new_jobs = []

    try:
        from jobspy import scrape_jobs
        print("Scraping via python-jobspy...")
        jobs_df = scrape_jobs(
            site_name=["linkedin", "indeed"],
            search_term="developer OR engineer OR sales OR electrical",
            location="India",
            results_wanted=25,
            hours_old=72,
            country_indeed='India'
        )

        if jobs_df is not None and not jobs_df.empty:
            for _, row in jobs_df.iterrows():
                title = str(row.get("title", "") or "").strip()
                company = str(row.get("company", "") or "").strip()
                if not title or not company:
                    continue

                job_id = f"job-{uuid.uuid4().hex[:8]}"
                location = str(row.get("location", "") or "India").strip()
                job_type = str(row.get("job_type", "") or "Full-time").capitalize()
                job_url = str(row.get("job_url", "") or "")
                description = str(row.get("description", "") or "").strip()
                # Truncate long descriptions for frontend performance
                if len(description) > 280:
                    description = description[:277] + "..."

                salary = ""
                if row.get("min_amount") and row.get("max_amount"):
                    salary = f"{row.get('min_amount')} - {row.get('max_amount')} {row.get('currency', 'INR')}"

                new_jobs.append({
                    "id": job_id,
                    "title": title,
                    "company": company,
                    "location": location,
                    "job_type": job_type,
                    "experience": "Not specified",
                    "salary": salary or "Competitive",
                    "posted_date": "Recently",
                    "description": description,
                    "job_link": job_url
                })
            print(f"Successfully scraped {len(new_jobs)} jobs via JobSpy.")
    except ImportError:
        print("JobSpy package not installed. Using fallback verified feeds.")
    except Exception as e:
        print(f"JobSpy scrape error: {e}. Preserving verified feed data.")

    # If new jobs scraped, merge and deduplicate by title + company
    if new_jobs:
        combined = new_jobs + existing_jobs
        seen = set()
        deduped = []
        for j in combined:
            key = (j.get("title", "").lower(), j.get("company", "").lower())
            if key not in seen and key[0]:
                seen.add(key)
                deduped.append(j)
        final_jobs = deduped[:100]
    else:
        final_jobs = existing_jobs

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(final_jobs, f, indent=2, ensure_ascii=False)

    print(f"Updated {output_file} with {len(final_jobs)} jobs.")

if __name__ == "__main__":
    run_scraper()
