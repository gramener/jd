# Resume Analyzer

This project is a web-based application designed to analyze resumes against a job description using AI-powered analysis. It helps in evaluating candidate matches based on skills, experience, and other relevant criteria.

## Features

- **File Upload**: Upload job descriptions and resumes in DOCX or PDF format.
- **AI Analysis**: Leverages AI to extract and match relevant information from resumes against job descriptions.
- **Skill Evaluation**: Identifies mandatory and optional skills from the job description and evaluates resumes accordingly.
- **Results Display**: Presents analysis results in a tabular format with options to download as CSV.
- **Best Match Identification**: Provides a recommendation for the best candidate match based on the analysis.

## How It Works

1. **Upload Job Description**: Users can upload a job description file. The application processes the file to extract mandatory skills using AI.

2. **Upload Resumes**: Users can upload multiple resume files. The application reads and analyzes each resume against the job description.

3. **AI-Powered Analysis**: The application uses AI to compare resumes with the job description, evaluating skills, experience, and other criteria.

4. **Display Results**: The analysis results are displayed in a table, showing details like candidate name, contact information, experience, and fit scores.

5. **Download Results**: Users can download the analysis results as a CSV file for further review.

6. **Best Match**: The application identifies the best candidate match and provides a concise recommendation.

## Setup and Usage

1. **Clone the Repository**: Clone this repository to your local machine.

2. **Start a Local Server**: Navigate to the project directory in your terminal and run `python -m http.server`. Then, open your web browser and go to `http://localhost:8000` to access the application interface.

3. **Upload Files**: Use the file upload sections to upload a job description and resumes.

4. **Analyze Resumes**: Click the "Analyse Resumes" button to start the analysis process.

5. **View Results**: Check the results table for detailed analysis and download the results as needed.

6. **Get Best Match**: Click the "Get Best Match" button to see the recommended candidate.

## Dependencies

- **Mammoth.js**: Used for extracting text from DOCX files.
- **PDF.js**: Used for extracting text from PDF files.
- **Bootstrap**: For styling the application interface.
- **Gramex UI**: For additional UI components and theme support.

## Acknowledgments

- Designed and developed by Gramener.
