const PEOPLE = [
  "Alex Rivera", "Jordan Kim", "Maya Patel", "Noah Williams", "Priya Raman",
  "Taylor Morgan", "Avery Chen", "Samira Hassan", "Diego Torres", "Morgan Lee",
  "Casey Nguyen", "Riley Johnson", "Amara Okafor", "Elias Cohen", "Sofia Martinez",
  "Cameron Brooks", "Iris Zhang", "Theo Anderson", "Nadia Rahman", "Julian Park",
];

const PERSONAS = [
  { section: "RESEARCH EXPERIENCE", category: "Research experience", title: "Research Assistant | Harbor Genomics Lab", bullet: "Analyzed sequencing data, documented quality checks, and presented findings to a five-person research team." },
  { section: "PROFESSIONAL EXPERIENCE", category: "Professional experience", title: "Software Engineering Intern | City Transit", bullet: "Built an accessible route-planning feature and reduced average support requests by 18 percent." },
  { section: "ENTREPRENEURSHIP", category: "Project or impact", title: "Founder | Cedar Learning", bullet: "Launched a tutoring marketplace, interviewed 40 families, and coordinated 12 tutors." },
  { section: "NONPROFIT EXPERIENCE", category: "Community contribution", title: "Program Lead | Open Pantry Network", bullet: "Organized weekly food distributions with 25 volunteers and served 300 households." },
  { section: "TEACHING EXPERIENCE", category: "Professional experience", title: "Mathematics Tutor | Northside Learning Center", bullet: "Designed weekly lessons and helped 16 students strengthen algebra skills." },
  { section: "SELECTED PROJECTS", category: "Project or impact", title: "WaterWatch | Project Lead", bullet: "Designed a low-cost sensor dashboard and tested the prototype at three community sites." },
  { section: "LEADERSHIP", category: "Leadership", title: "President | Robotics Club", bullet: "Led a 22-member team, introduced peer mentorship, and organized two regional workshops." },
  { section: "COMMUNITY SERVICE", category: "Community contribution", title: "Volunteer Coordinator | Neighborhood Library", bullet: "Recruited 30 volunteers and expanded weekend literacy programming." },
  { section: "CREATIVE PORTFOLIO", category: "Project or impact", title: "Designer | Memory Maps", bullet: "Created an interactive installation from 80 oral-history recordings and visitor feedback." },
  { section: "WORK EXPERIENCE", category: "Professional experience", title: "Medical Assistant | Desert Family Clinic", bullet: "Prepared patient rooms, maintained records, and supported a four-provider care team." },
  { section: "EXPERIENCE", category: "Professional experience", title: "Electrician Apprentice | Sun Valley Electric", bullet: "Installed and tested residential circuits while following documented safety procedures." },
  { section: "ATHLETICS & LEADERSHIP", category: "Leadership", title: "Team Captain | Varsity Soccer", bullet: "Led warmups, mentored younger players, and coordinated a community equipment drive." },
  { section: "FREELANCE EXPERIENCE", category: "Professional experience", title: "Freelance Photographer", bullet: "Planned and delivered 35 client shoots while managing schedules, editing, and invoicing." },
  { section: "PUBLICATIONS", category: "Research experience", title: "Student Author | Public Health Review", bullet: "Co-authored a review of heat-risk interventions and verified 60 cited sources." },
  { section: "AWARDS & HONORS", category: "Award or distinction", title: "Regional Community Innovation Award", bullet: "Selected as one of eight finalists for a documented neighborhood-access project." },
];

const SCHOOLS = [
  "North Valley High School", "Mesa Preparatory Academy", "University of Washington",
  "Arizona State University", "Central Community College", "Lakeshore Polytechnic Institute",
];

function padded(index) {
  return String(index % 10_000).padStart(4, "0");
}

function renderResume({ name, email, phone, school, graduationYear, gradeLevel, persona, index, format }) {
  const education = `${school} | ${gradeLevel} | Expected May ${graduationYear}`;
  const link = `https://portfolio.example/candidate-${index}`;
  const blocks = {
    standard: `${name}\n${email} | ${phone} | ${link}\n\nEDUCATION\n${education}\n\n${persona.section}\n${persona.title}\n• ${persona.bullet}\n\nSKILLS\nCommunication, documentation, spreadsheet analysis`,
    compact: `${name}\n${email}  ${phone}\n${link}\nEDUCATION: \n${education}\n${persona.section}:\n${persona.title} | 2025-Present\n${persona.bullet}`,
    plain: `${name}\n${email}\n${phone}\n${link}\nACADEMIC BACKGROUND\n${education}\n${persona.section}\n${persona.title}\n${persona.bullet}`,
    noisy_pdf: `${name}\n${email}     ${phone}\n${link}\nE D U C A T I O N\nEDUCATION\n${education}\n${persona.section}\n${persona.title}\n- ${persona.bullet}\nPage 1 of 1`,
    cv: `${name}\nCURRICULUM VITAE\nContact: ${email} | ${phone}\nWebsite: ${link}\nEDUCATION\n${education}\n${persona.section}\n${persona.title}\n${persona.bullet}\nREFERENCES AVAILABLE ON REQUEST`,
  };
  return blocks[format];
}

export function generateSyntheticResumeCases(count = 10_000) {
  const formats = ["standard", "compact", "plain", "noisy_pdf", "cv"];
  return Array.from({ length: count }, (_, index) => {
    const name = PEOPLE[index % PEOPLE.length];
    const persona = PERSONAS[index % PERSONAS.length];
    const school = SCHOOLS[index % SCHOOLS.length];
    const graduationYear = String(2027 + (index % 3));
    const gradeLevel = `${10 + (index % 3)}th grade`;
    const email = `${name.toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "")}.${index}@example.test`;
    const phone = `+1 (480) 555-${padded(index)}`;
    const format = formats[index % formats.length];
    return {
      id: `synthetic-resume-${index}`,
      text: renderResume({ name, email, phone, school, graduationYear, gradeLevel, persona, index, format }),
      expected: { name, email, phone, school, graduationYear, gradeLevel, category: persona.category, experience: `${persona.title} ${persona.bullet}` },
      metadata: { synthetic: true, persona: persona.section, format },
    };
  });
}
