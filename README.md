# Secure Exam Flow 

A frontend-based **secure online examination flow** built with modern web technologies to demonstrate how online exam systems manage controlled navigation, exam rules, and submission logic.

This project emphasizes **exam integrity, structured flow, and a distraction-free user experience**, making it suitable for academic demonstrations and portfolio showcases.

---

## 🚀 Features

- 🔐 **Secure Exam Flow**
  - Enforces start → attempt → submit sequence
  - Prevents skipping mandatory exam steps
  - Controlled navigation during the exam

- ⏱️ **Exam Experience**
  - Timed exam logic
  - Smooth transitions between questions
  - Submission confirmation handling

- 🎯 **Focused UI**
  - Minimal and distraction-free interface
  - Responsive across different screen sizes

- ⚡ **High Performance**
  - Fast development and builds using Vite

---

## 👥 User Roles

---

### 1️⃣ Teacher (Paper Setter)
**Goal:** Upload exam papers securely

**Permissions**
- Upload papers for assigned subjects
- Upload multiple sets (A, B, C)
- Edit/replace before deadline
- View status (Pending / Approved / Rejected)
- View HOD feedback

**Restrictions**
- ❌ Cannot view other teachers’ papers  
- ❌ Cannot download after deadline  

---

### 2️⃣ HOD (Head of Department)
**Goal:** Select the final paper (bias-free)

**Permissions**
- View all papers for their department
- Anonymous comparison (no teacher names)
- Select **one** paper per subject
- Reject papers with remarks
- Lock and forward final paper to Exam Cell

⭐ Papers are shown as **Paper 1, Paper 2, Paper 3**

---

### 3️⃣ Examination Cell
**Goal:** Conduct exams securely

**Permissions**
- Access only HOD-approved papers
- Time-based paper unlock
- Download & print with watermark
- Track usage and archive papers

---

## 🔁 Core Workflow

1. **Teacher uploads** encrypted PDF → deadline enforced  
2. **HOD reviews** anonymously → selects one paper  
3. **Exam Cell receives** approved paper → locked until exam time  
4. **Post-exam:** papers archived, downloads disabled, logs saved  

---

## 🖥️ Dashboards

### 📘 Teacher
- Subject list & upload status
- Deadline timer
- PDF validation
- Feedback & resubmission

### 📕 HOD
- Department-wise papers
- Anonymous comparison
- Preview, select & lock
- Rejection remarks

### 📙 Examination Cell
- Exam calendar
- Approved papers inbox
- Secure access & print
- Exam archive


## 🛠️ Tech Stack

- **Frontend Framework:** React  
- **Language:** JavaScript  
- **Build Tool:** Vite  
- **Styling:** CSS  
- **Deployment:** Vercel  

---


## 🧑‍💻 Getting Started

### 1️⃣ Clone the repository
```git clone https://github.com/nimrawani04/secure-exam-flow.git```
