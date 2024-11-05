let mammoth;
let pdfjs;

const readFile = {
    default: async (file) => ({ name: file.name, type: file.type, data: await file.text() }),
    docx: async function (file) {
        if (!mammoth) mammoth = await import("https://cdn.jsdelivr.net/npm/mammoth@1/+esm");
        let textContent;
        try {
            textContent = (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
        } catch (error) {
            console.error(error);
            textContent = "Error reading DOCX:" + error;
        }
        return { name: file.name, type: file.type, data: textContent };
    },
    pdf: async function (file) {
        if (!pdfjs) {
            pdfjs = await import("https://cdn.jsdelivr.net/npm/pdfjs-dist@4.7/+esm");
            pdfjs.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.7/build/pdf.worker.min.mjs";
        }
        const data = await file.arrayBuffer();
        let textContent;
        try {
            const pdf = await pdfjs.getDocument(data).promise;
            textContent = await Promise.all(
                Array.from({ length: pdf.numPages }, (_, i) => i + 1).map(async (pageNum) => {
                    const page = await pdf.getPage(pageNum);
                    const textContent = await page.getTextContent();
                    return textContent.items.map((item) => item.str).join("\n");
                }),
            );
        } catch (error) {
            console.error(error);
            textContent = ["Error reading PDF:" + error];
        }
        return { name: file.name, type: file.type, data: textContent.join("\n\n") };
    },
};

document.getElementById('uploadJD').addEventListener('click', async function () {
    const jdFile = document.getElementById('jdFile').files[0];
    const jdLoadingSpinner = document.getElementById('jdLoadingSpinner');

    if (!jdFile) {
        alert("Please upload a Job Description file.");
        return;
    }

    // Show spinner
    jdLoadingSpinner.style.display = 'block';

    try {
        let jobDescription;
        if (jdFile.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
            jobDescription = await readFile.docx(jdFile);
        } else if (jdFile.type === "application/pdf") {
            jobDescription = await readFile.pdf(jdFile);
        } else {
            jobDescription = await readFile.default(jdFile);
        }

        const mandatorySkills = await getMandatorySkillsFromJD(jobDescription.data);
        displayMandatorySkills(mandatorySkills);
        window.jobDescription = jobDescription.data; // Store job description globally for later use
        window.mandatorySkills = mandatorySkills; // store mandatory skills globally

    } catch (error) {
        console.error("Error processing Job Description:", error);
        alert("An error occurred while processing the Job Description. Please try again.");
    } finally {
        // Hide spinner
        jdLoadingSpinner.style.display = 'none';
    }
});


async function extractInformation(resumeFileName, resumeText, mandatorySkills, optionalSkills, additionalInstructions, jobDescription) {
    if (typeof mandatorySkills !== 'object' || mandatorySkills === null) {
        throw new TypeError("Expected 'mandatorySkills' to be an object");
    }

    let prompt = `
You are an AI engine tasked with analyzing a provided "Job Description" (JD) and comparing it against a "Resume" to extract and match relevant information. Your goal is to evaluate the resume against the job requirements and skills.

Task Content:
1. Job Description Analysis:
   Carefully review the "Job Description" to understand the role, responsibilities, and the required skills and experience.
2. Resume Analysis:
   Examine the "Resume Text" to assess the candidate's skills, experience, and qualifications.\n
3. Comparison and Matching:
   Compare the skills and experience from the resume against the requirements listed in the JD.
   If there are mandatory skills with weightages provided, check whether the resume contains those skills and assess them accordingly.
   Consider any additional skills mentioned in the JD and evaluate whether the resume reflects those skills.\n
4. Recommendation:
   Based on your analysis, provide a final assessment on how well the resume matches the JD.
   Do not leave any required fields unanswered. Ensure all requested information is provided without deviating from the context.\n
5. Note:
   Ensure that the analysis is thorough, relevant, and concise. Avoid generating text that is unrelated or unnecessary for the task.
   Do not generate information that is not given in the resume and provide reasons where required.
   If there is no information available for the required parameter then return "N/A".

Output JSON:
{
  "Candidate Name": "Candiate Name from Resume Text",
  "Phone No.": "Phone number Candiate Name from Resume Text",
  "Email": "Email Candiate Name from Resume Text",
  "Relevant Experience in years (w.r.t JD)": "Get the relevant experience",
  "Overall Exp in years": "Get the overall experience",
  "Overall Fit Score (1/10) (w.r.t JD)": { "score": number, "Reason": text },
  "Mandatory Skills Score (1/10)": {
    "Mandatory skill 1": { "score": number, "Reason": text },
    "Mandatory skill 2": { "score": number, "Reason": text },
    "Mandatory skill 3": { "score": number, "Reason": text },
    "Mandatory skill 4": { "score": number, "Reason": text },
    "Mandatory skill 5": { "score": number, "Reason": text },
  },
  "Domain Knowledge (1 to 10) (w.r.t JD)": { "score": number, "Reason": text },
  "Final Recommendation": "Give the Final recommendation",
}
`;

    prompt += `Job Description:\n${jobDescription}\n\n`;
    prompt += `Mandatory Skills and Weightages:\n`;
    for (const [skill, weightage] of Object.entries(mandatorySkills)) {
        prompt += `Mandatory skill ${skill}: ${weightage}/10\n`;
    }

    prompt += `\nOptional Skills:\n${optionalSkills}\n\n`;
    prompt += `Additional Instructions:\n${additionalInstructions}\n\n`;
    prompt += `Resume File Name: ${resumeFileName}\n`;
    prompt += `Resume Text:\n${resumeText}\n`;
    prompt += `Candidate Name: [Get name of the candidate from the Resume Text]\n`;
    prompt += `Phone No.: [Get Phone number of the candidate from the Resume Text]\n`;
    prompt += `Email: [Get Email address of the candidate from the Resume Text]\n`;
    prompt += `Relevant Experience in years (w.r.t JD): [get the relevant experience of the candidate from the Resume Text comparing to the JD Requirement and if blank please provide the reason.]\n`;
    prompt += `Overall Exp in years: [Overall experience of the candidate from the Resume Text and if blank please provide the reason.]\n`;
    prompt += `Overall Fit Score (1/10) (w.r.t JD): [Rate out of 1-10 based on the Job Description and average weightages of mandatory skills. The output should be integer/float and rating is compulsory. Also please specify with the reason for the given rating.]\n`;
    prompt += `Mandatory Skills Score (1/10): [it is also compulsory to provide the rating for each mandatory skill with each skill name and their respective rating and also please specify with the reason for the each individual skill rating, if blank please provide the reason why it is blank.]\n`;
    prompt += `Domain Knowledge (1 to 10) (w.r.t JD): [Rate him out of 1-10 on the basis of mandatory skills and Job Description. The output should be integer/float and rating is compulsory also specify with the reason for the given rating.]\n`;
    prompt += `Final Recommendation: [Include the Total relevant experience as the first sentence followed by the summary and the summary should be 4-5 lines of the resume to recommend or not based on the mandatory skills, Additional Instructions, Optional Skills.]\n\n`;

    // Fetch data from OpenAI API
    const response = await fetch('https://llmfoundry.straive.com/openai/v1/chat/completions', {
        method: 'POST',
        credentials : 'include',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }]
        })
    });

    const data = await response.json();
    console.log(data);
    return data; // Adjust according to your needs
}
// Helper function to safely calculate mandatory skills average
function calculateMandatorySkillsAverage(skillsObj) {
    if (!skillsObj || typeof skillsObj !== 'object') return "N/A";

    const scores = Object.values(skillsObj)
        .filter(score => typeof score === 'number');

    if (scores.length === 0) return "N/A";

    return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2);
}

async function getMandatorySkillsFromJD(jobDescription) {
    const prompt = `Job Description:\n${jobDescription}\n\nPlease analyze the job description and provide exactly 5 mandatory skills in the following JSON format without any markdown or code block indicators:
    {
        "skills": [
            {"name": "skill1", "description": "brief description"},
            {"name": "skill2", "description": "brief description"},
            {"name": "skill3", "description": "brief description"},
            {"name": "skill4", "description": "brief description"},
            {"name": "skill5", "description": "brief description"}
        ]
    }`;

    const response = await fetch('https://llmfoundry.straive.com/openai/v1/chat/completions', {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
        }),
    });

    if (!response.ok) {
        const errorDetails = await response.json();
        throw new Error(`Error: ${errorDetails.message || 'Failed to fetch skills'}`);
    }

    const data = await response.json();
    let content = data.choices[0].message.content;

    // Clean the response by removing markdown code blocks and any extra whitespace
    content = content.replace(/```json\n?/g, '')
                    .replace(/```\n?/g, '')
                    .trim();

    try {
        const skillsData = JSON.parse(content);
        return skillsData.skills;
    } catch (error) {
        console.error("Original content:", content);
        console.error("JSON parsing error:", error);
        throw new Error("Failed to parse skills data from AI response");
    }
}

// Function to display mandatory skills
function displayMandatorySkills(skills) {
    const skillsDiv = document.getElementById('mandatorySkills');
    skillsDiv.innerHTML = ''; // Clear existing content

    if (skills.length > 0) {
        const table = document.createElement('table');
        table.classList.add('table', 'my-5');

        // Create table header
        const header = table.createTHead();
        const headerRow = header.insertRow();
        ['AI Suggested Skill', 'Custom Skill Name', 'Weightage'].forEach(text => {
            const th = document.createElement('th');
            th.textContent = text;
            headerRow.appendChild(th);
        });

        // Create table body
        const tbody = table.createTBody();
        skills.forEach((skill, index) => {
            const row = tbody.insertRow();

            // AI Suggested Skill (read-only)
            const suggestionCell = row.insertCell();
            suggestionCell.textContent = `${skill.name} - ${skill.description}`;

            // Custom Skill Input
            const customCell = row.insertCell();
            const customInput = document.createElement('input');
            customInput.type = 'text';
            customInput.id = `custom_${index}`;
            customInput.value = skill.name;
            customInput.className = 'custom-skill-input';
            customCell.appendChild(customInput);

            // Weightage Slider
            const weightageCell = row.insertCell();
            const weightageContainer = document.createElement('div');
            weightageContainer.className = 'weightage-container';

            const weightageInput = document.createElement('input');
            weightageInput.type = 'range';
            weightageInput.min = '1';
            weightageInput.max = '10';
            weightageInput.value = '5';
            weightageInput.id = `weightage_${index}`;

            const weightageValue = document.createElement('span');
            weightageValue.textContent = weightageInput.value;
            weightageValue.className = 'weightage-value';

            weightageContainer.appendChild(weightageInput);
            weightageContainer.appendChild(weightageValue);
            weightageCell.appendChild(weightageContainer);

            // Update weightage display
            weightageInput.addEventListener('input', function() {
                weightageValue.textContent = this.value;
            });
        });

        skillsDiv.appendChild(table);
    } else {
        skillsDiv.innerHTML = "<p class='no-skills'>No mandatory skills found.</p>";
    }
}

async function getBestMatch(finalRecommendations, additionalInstructions = "") {
    if (!additionalInstructions) {
        additionalInstructions = "no additional instructions are given";
    }

    const prompt =
        `Here are the final recommendations:\n${finalRecommendations}\n\n` +
        `Additional Instructions:\n${additionalInstructions}\n\n` +
        `Identify the best candidate for the role and provide a concise statement with the candidate's name and key qualifications.`;

    const response = await fetch('https://llmfoundry.straive.com/openai/v1/chat/completions', {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }]
        })
    });

    const data = await response.json();
    return data.choices[0].message.content;
}

document.getElementById('getBestMatch').addEventListener('click', async function () {
    if (!window.finalRecommendations) {
        alert("Please analyze resumes first before getting the best match.");
        return;
    }

    const additionalInstructions = document.getElementById('additionalInstructions').value;
    const bestMatchResult = document.getElementById('bestMatchResult');
    const bestMatchContent = document.getElementById('bestMatchContent');

    try {
        // Show loading state
        this.disabled = true;
        this.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Finding best match...';

        const bestMatch = await getBestMatch(window.finalRecommendations, additionalInstructions);

        // Display the result in the card
        bestMatchContent.textContent = bestMatch;
        bestMatchResult.style.display = 'block';

    } catch (error) {
        console.error("Error finding best match:", error);
        alert("An error occurred while finding the best match. Please try again.");
    } finally {
        // Reset button state
        this.disabled = false;
        this.innerHTML = 'Get Best Match';
    }
});

// Function to add a row in the results table
function addResultRow(data, resumeFileName) {
    const tbody = document.getElementById('resultsBody');
    const newRow = tbody.insertRow();
    newRow.innerHTML = `
        <td>${resumeFileName}</td>
        <td>${data.name}</td>
        <td>${data.phone}</td>
        <td>${data.email}</td>
        <td>${data.relevantExperience}</td>
        <td>${data.overallExperience}</td>
        <td>${data.overallFitScore}</td>
        <td>${data.mandatorySkillsScore}</td>
        <td>${data.domainKnowledge}</td>
        <td>${data.finalRecommendation}</td>
    `;
}

// Analyse resumes event listener (combines upload and analysis)
document.getElementById('analyseButton').addEventListener('click', async function () {
    const resultsTable = document.getElementById('resultsTable');
    const resultsBody = document.getElementById('resultsBody');
    const loadingSpinner = document.getElementById('loadingSpinner');

    // Check if job description exists
    if (!window.jobDescription || !window.mandatorySkills) {
        alert("Please upload and process a Job Description first.");
        return;
    }

    const resumeFiles = document.getElementById('resumeFiles').files;
    if (resumeFiles.length === 0) {
        alert("Please select resumes before analyzing.");
        return;
    }
    // Clear existing results
    resultsBody.innerHTML = '';
    // Show spinner
    loadingSpinner.style.display = 'block';
    let finalRecommendations = [];
    try {
        for (const resumeFile of resumeFiles) {
            let resumeText;
            if (resumeFile.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
                resumeText = await readFile.docx(resumeFile);
            } else if (resumeFile.type === "application/pdf") {
                resumeText = await readFile.pdf(resumeFile);
            } else {
                resumeText = await readFile.default(resumeFile);
            }

            const optionalSkills = document.getElementById('optionalSkills')
                .value
                .split('\n')
                .map(skill => skill.trim())
                .filter(skill => skill.length > 0);

            // Process the resume and add results to the table
            const result = await extractInformation(
                resumeFile.name,
                resumeText.data,
                window.mandatorySkills,
                optionalSkills,
                document.getElementById('additionalInstructions').value,
                window.jobDescription
            );

            try {
                let contentStr = result.choices[0].message.content;
                contentStr = contentStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
                const analysis = JSON.parse(contentStr.trim());

                // Add this after parsing the analysis
                finalRecommendations.push({
                    name: analysis["Candidate Name"] || "N/A",
                    recommendation: analysis["Final Recommendation"] || "N/A"
                });

                addResultRow({
                    name: analysis["Candidate Name"] || "N/A",
                    phone: analysis["Phone No."] || "N/A",
                    email: analysis["Email"] || "N/A",
                    relevantExperience: analysis["Relevant Experience in years (w.r.t JD)"] || "N/A",
                    overallExperience: analysis["Overall Exp in years"] || "N/A",
                    overallFitScore: analysis["Overall Fit Score (1/10) (w.r.t JD)"]?.score || "N/A",
                    mandatorySkillsScore: calculateMandatorySkillsAverage(analysis["Mandatory Skills Score (1/10)"]),
                    domainKnowledge: analysis["Domain Knowledge (1 to 10) (w.r.t JD)"]?.score || "N/A",
                    finalRecommendation: analysis["Final Recommendation"] || "N/A"
                }, resumeFile.name);
            } catch (error) {
                console.error("Error processing resume:", error);
                addResultRow({
                    name: "Error",
                    phone: "Error",
                    email: "Error",
                    relevantExperience: "Error",
                    overallExperience: "Error",
                    overallFitScore: "Error",
                    mandatorySkillsScore: "Error",
                    domainKnowledge: "Error",
                    finalRecommendation: "Error processing resume"
                }, resumeFile.name);
            }
        }

        // Add this before showing the results table
        window.finalRecommendations = finalRecommendations.map(r =>
            `Candidate: ${r.name}\nRecommendation: ${r.recommendation}`
        ).join('\n\n');

        // Show the results table and download button
        resultsTable.classList.remove('d-none');
        document.getElementById('downloadCSV').style.display = 'inline-block';

    } catch (error) {
        console.error("Error in resume analysis:", error);
        alert("An error occurred while analyzing the resumes. Please try again.");
    } finally {
        // Hide spinner
        loadingSpinner.style.display = 'none';
    }
});

// Function to convert table to CSV
function tableToCSV() {
    const table = document.getElementById('resultsTable');
    let csv = [];

    // Get headers
    let headers = [];
    for(let cell of table.rows[0].cells) {
        headers.push(cell.textContent);
    }
    csv.push(headers.join(','));

    // Get rows
    for(let row of table.rows) {
        if(row.rowIndex === 0) continue; // Skip header row
        let rowData = [];
        for(let cell of row.cells) {
            // Escape quotes and wrap content in quotes to handle commas in content
            let content = cell.textContent.replace(/"/g, '""');
            rowData.push(`"${content}"`);
        }
        csv.push(rowData.join(','));
    }

    return csv.join('\n');
}

// Function to download CSV
function downloadCSV(csvContent, filename) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (navigator.msSaveBlob) { // IE 10+
        navigator.msSaveBlob(blob, filename);
    } else {
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// Add click event listener for download button
document.getElementById('downloadCSV').addEventListener('click', function() {
    const csv = tableToCSV();
    const filename = 'resume_analysis_results_' + new Date().toISOString().slice(0,10) + '.csv';
    downloadCSV(csv, filename);
});
