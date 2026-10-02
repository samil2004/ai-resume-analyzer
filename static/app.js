const skillCatalog = [
  "Machine Learning", "Project Management", "Data Analysis", "REST API", "PostgreSQL",
  "JavaScript", "TypeScript", "Communication", "FastAPI", "TensorFlow", "PyTorch",
  "Python", "Django", "Flask", "React", "Node.js", "MongoDB", "MySQL", "Docker",
  "Pandas", "HTML", "CSS", "NLP", "AWS", "Azure", "Figma", "Git", "SQL"
];

const resumeSkills = document.querySelector("#resume-skills");
const jobDescription = document.querySelector("#job-description");
const authDialog = document.querySelector("#auth-dialog");
const toast = document.querySelector("#toast");
let currentUser = null;
let savedMatches = [];
let lastAnalysis = null;
let pendingSave = null;
let authMode = "login";
let toastTimer;

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(path, { ...options, headers, credentials: "same-origin" });
  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.detail || "Something went wrong. Please try again.");
  return payload;
}

function detectSkills(text) {
  const normalizedText = text.toLowerCase();
  return skillCatalog.filter((skill) => {
    const escapedSkill = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9])${escapedSkill}s?(?=$|[^a-z0-9])`, "i").test(normalizedText);
  });
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 2800);
}

function setMessage(selector, message, isError = false) {
  const element = document.querySelector(selector);
  element.textContent = message;
  element.classList.toggle("error", isError);
}

function setSkillChips(container, skills, isMissing = false) {
  container.replaceChildren();
  if (skills.length === 0) {
    const empty = document.createElement("span");
    empty.className = "empty-skill";
    empty.textContent = isMissing ? "No gaps found in the detected list" : "No overlapping skills detected";
    container.append(empty);
    return;
  }

  skills.forEach((skill, index) => {
    const chip = document.createElement("span");
    chip.className = isMissing ? "skill-chip missing" : "skill-chip";
    chip.style.animationDelay = `${index * 35}ms`;
    chip.textContent = skill;
    container.append(chip);
  });
}

function switchView(viewName) {
  const target = document.querySelector(`[data-page="${viewName}"]`);
  if (!target) return;
  document.querySelectorAll(".app-view").forEach((view) => {
    const active = view === target;
    view.hidden = !active;
    view.classList.toggle("active", active);
  });
  document.querySelectorAll(".side-nav .nav-item").forEach((item) => {
    const active = item.dataset.view === viewName;
    item.classList.toggle("active", active);
    if (active) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  });
  const activeNav = document.querySelector(`.side-nav [data-view="${viewName}"] span:last-child`);
  document.querySelector("#current-section-name").textContent = activeNav?.textContent.trim() || "Overview";
  if (viewName === "saved" || viewName === "overview" || viewName === "skills") refreshMatches();
  if (viewName === "account" && currentUser) fillProfile();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setAuthenticationUI() {
  const signedIn = Boolean(currentUser);
  const name = currentUser?.full_name || "Guest";
  const initial = signedIn ? (name.trim()[0] || "A").toUpperCase() : "?";
  document.querySelector("#auth-open").textContent = signedIn ? "My account" : "Sign in";
  document.querySelector("#auth-open").classList.toggle("signed-in", signedIn);
  document.querySelector("#sidebar-name").textContent = name;
  document.querySelector("#sidebar-caption").textContent = signedIn ? currentUser.email : "Sign in to save work";
  document.querySelector("#sidebar-avatar").textContent = initial;
  document.querySelector("#settings-avatar").textContent = initial;
  document.querySelector("#account-nudge").hidden = signedIn;
  document.querySelector("#saved-nav-count").textContent = savedMatches.length;
  if (!signedIn) {
    document.querySelector("#overview-copy").textContent = "Bring a role into focus. Create an account to keep your matches between visits.";
  } else {
    document.querySelector("#overview-copy").textContent = `Welcome back, ${name.split(/\s+/)[0]}. Your matches and skill gaps are ready when you are.`;
  }
  if (signedIn) fillProfile();
  renderWorkspace();
}

function fillProfile() {
  if (!currentUser) return;
  document.querySelector("#profile-name").value = currentUser.full_name;
  document.querySelector("#profile-email").value = currentUser.email;
  document.querySelector("#profile-skills").value = (currentUser.resume_skills || []).join(", ");
  if (!resumeSkills.value.trim() && currentUser.resume_skills?.length) {
    resumeSkills.value = currentUser.resume_skills.join(", ");
  }
}

async function refreshMatches() {
  if (!currentUser) {
    savedMatches = [];
    renderWorkspace();
    return;
  }
  try {
    savedMatches = await api("/api/matches");
    renderWorkspace();
  } catch (error) {
    showToast(error.message);
  }
}

function makeSavedCard(match, compact = false) {
  const article = document.createElement("article");
  article.className = "saved-card";
  article.style.animationDelay = `${Math.min(savedMatches.indexOf(match), 5) * 35}ms`;

  const main = document.createElement("div");
  main.className = "saved-card-main";
  const meta = document.createElement("div");
  meta.className = "saved-card-meta";
  const date = document.createElement("span");
  date.textContent = new Date(match.created_at * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const gap = document.createElement("span");
  gap.textContent = `${match.missing_skills.length} skills to explore`;
  meta.append(date, gap);

  const title = document.createElement("h3");
  title.textContent = match.job_title;
  const company = document.createElement("p");
  company.className = "saved-card-company";
  company.textContent = match.company || "Company not specified";
  const chips = document.createElement("div");
  chips.className = "saved-card-chips";
  (match.matched_skills || []).slice(0, compact ? 3 : 5).forEach((skill) => {
    const chip = document.createElement("span");
    chip.className = "skill-chip";
    chip.textContent = skill;
    chips.append(chip);
  });
  main.append(meta, title, company, chips);

  const score = document.createElement("div");
  score.className = "saved-card-score";
  const scoreValue = document.createElement("strong");
  scoreValue.textContent = `${match.score}%`;
  const scoreLabel = document.createElement("span");
  scoreLabel.textContent = "FIT";
  score.append(scoreValue, scoreLabel);

  const actions = document.createElement("div");
  actions.className = "saved-card-actions";
  const reopen = document.createElement("button");
  reopen.type = "button";
  reopen.dataset.action = "reopen";
  reopen.dataset.matchId = match.id;
  reopen.textContent = "Open comparison";
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "delete-match";
  remove.dataset.action = "delete";
  remove.dataset.matchId = match.id;
  remove.textContent = "Remove";
  actions.append(reopen, remove);
  article.append(main, score, actions);
  return article;
}

function renderSkillMap() {
  const container = document.querySelector("#skill-plan-list");
  container.replaceChildren();
  const counts = new Map();
  savedMatches.forEach((match) => {
    new Set(match.missing_skills || []).forEach((skill) => counts.set(skill, (counts.get(skill) || 0) + 1));
  });
  const sorted = [...counts.entries()].sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0]));
  if (!sorted.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state compact-empty";
    const mark = document.createElement("span");
    mark.className = "empty-mark";
    mark.textContent = "03";
    const title = document.createElement("strong");
    title.textContent = "Your skill map will take shape";
    const text = document.createElement("p");
    text.textContent = currentUser ? "Save a few role matches to see the capabilities employers ask for most." : "Create an account and save role matches to see recurring skill gaps.";
    empty.append(mark, title, text);
    container.append(empty);
    return;
  }

  const maxCount = sorted[0][1];
  sorted.slice(0, 8).forEach(([skill, count], index) => {
    const row = document.createElement("div");
    row.className = "skill-plan-row";
    const rank = document.createElement("span");
    rank.className = "skill-plan-rank";
    rank.textContent = String(index + 1).padStart(2, "0");
    const details = document.createElement("div");
    const name = document.createElement("div");
    name.className = "skill-plan-name";
    name.textContent = skill;
    const bar = document.createElement("div");
    bar.className = "skill-plan-bar";
    const fill = document.createElement("span");
    fill.style.width = `${(count / maxCount) * 100}%`;
    bar.append(fill);
    details.append(name, bar);
    const countLabel = document.createElement("span");
    countLabel.className = "skill-plan-count";
    countLabel.textContent = `In ${count} ${count === 1 ? "role" : "roles"}`;
    row.append(rank, details, countLabel);
    container.append(row);
  });
}

function renderWorkspace() {
  document.querySelector("#saved-nav-count").textContent = savedMatches.length;
  document.querySelector("#stat-total").textContent = savedMatches.length;
  const average = savedMatches.length ? Math.round(savedMatches.reduce((sum, match) => sum + match.score, 0) / savedMatches.length) : null;
  document.querySelector("#stat-average").textContent = average === null ? "--" : `${average}%`;
  const skillCount = new Set(savedMatches.flatMap((match) => match.missing_skills || [])).size;
  document.querySelector("#stat-skills").textContent = skillCount;
  document.querySelector("#library-count").textContent = `${savedMatches.length} saved ${savedMatches.length === 1 ? "role" : "roles"}`;

  const recent = document.querySelector("#dashboard-recent");
  recent.replaceChildren();
  if (!savedMatches.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state compact-empty";
    const mark = document.createElement("span");
    mark.className = "empty-mark";
    mark.textContent = "01";
    const title = document.createElement("strong");
    title.textContent = currentUser ? "Your shortlist starts here" : "Sign in to build your shortlist";
    const text = document.createElement("p");
    text.textContent = currentUser ? "Run a match, then save the roles you want to revisit." : "Create an account to keep your role comparisons between visits.";
    const action = document.createElement("button");
    action.type = "button";
    action.className = "text-button";
    if (currentUser) {
      action.dataset.viewTarget = "matcher";
      action.textContent = "Open match studio →";
    } else {
      action.dataset.authOpen = "register";
      action.textContent = "Create your account →";
    }
    empty.append(mark, title, text, action);
    recent.append(empty);
  } else {
    savedMatches.slice(0, 3).forEach((match) => recent.append(makeSavedCard(match, true)));
  }

  const library = document.querySelector("#saved-list");
  library.replaceChildren();
  if (!currentUser || !savedMatches.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    const mark = document.createElement("span");
    mark.className = "empty-mark";
    mark.textContent = "02";
    const title = document.createElement("strong");
    title.textContent = currentUser ? "Your library is ready" : "Sign in to see your library";
    const text = document.createElement("p");
    text.textContent = currentUser ? "Save a match from the studio and it will appear here." : "Your saved roles are private to your account.";
    const action = document.createElement("button");
    action.type = "button";
    action.className = "primary-button";
    if (currentUser) {
      action.dataset.viewTarget = "matcher";
      action.innerHTML = "<span>Compare a role</span><span aria-hidden=\"true\">&#8594;</span>";
    } else {
      action.dataset.authOpen = "login";
      action.innerHTML = "<span>Sign in</span><span aria-hidden=\"true\">&#8594;</span>";
    }
    empty.append(mark, title, text, action);
    library.append(empty);
  } else {
    savedMatches.forEach((match) => library.append(makeSavedCard(match)));
  }
  renderSkillMap();
}

function showAnalysis(result) {
  document.querySelector("#score-value").textContent = `${result.score}%`;
  document.querySelector("#score-ring").style.setProperty("--score-angle", `${result.score * 3.6}deg`);
  document.querySelector("#score-kicker").textContent = `${result.role_skills.length} role skills detected`;
  document.querySelector("#score-title").textContent = result.score >= 70 ? "Strong overlap." : result.score >= 40 ? "A promising start." : "Room to grow.";
  document.querySelector("#score-summary").textContent = `${result.matched_skills.length} of ${result.role_skills.length} detected role skills are in your list.`;
  document.querySelector("#matched-count").textContent = result.matched_skills.length;
  document.querySelector("#missing-count").textContent = result.missing_skills.length;
  document.querySelector("#result-live").replaceChildren(document.createElement("span"), document.createTextNode(" MATCH READY"));
  document.querySelector("#result-live").classList.add("ready");
  document.querySelector("#result-footnote").textContent = "Keyword overlap only; it does not assess experience, context, or seniority.";
  setSkillChips(document.querySelector("#matched-skills"), result.matched_skills);
  setSkillChips(document.querySelector("#missing-skills"), result.missing_skills, true);
  document.querySelector("#save-match-button").hidden = false;
}

function analyzeMatch() {
  const listedSkills = resumeSkills.value.split(/[,;\n]/).map((skill) => skill.trim()).filter(Boolean);
  const description = jobDescription.value.trim();
  const roleSkills = detectSkills(description);
  if (listedSkills.length === 0) {
    setMessage("#form-message", "Add at least one resume skill to compare.", true);
    resumeSkills.focus();
    return;
  }
  if (!description) {
    setMessage("#form-message", "Paste a job description to find its skills.", true);
    jobDescription.focus();
    return;
  }
  if (roleSkills.length === 0) {
    setMessage("#form-message", "No supported skills were detected. Try the example or include Python, SQL, or React.", true);
    return;
  }

  const normalizedSkills = new Set(listedSkills.map((skill) => skill.toLowerCase()));
  const matched = roleSkills.filter((skill) => normalizedSkills.has(skill.toLowerCase()));
  const missing = roleSkills.filter((skill) => !normalizedSkills.has(skill.toLowerCase()));
  const score = Math.round((matched.length / roleSkills.length) * 100);
  lastAnalysis = {
    job_title: document.querySelector("#job-title").value.trim() || "Untitled role",
    company: document.querySelector("#company-name").value.trim(),
    job_description: description,
    resume_skills: listedSkills,
    role_skills: roleSkills,
    matched_skills: matched,
    missing_skills: missing,
    score,
  };
  showAnalysis(lastAnalysis);
  setMessage("#form-message", "Match calculated. Save it to revisit later.");
}

function updateFile(file) {
  if (!file) return;
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    document.querySelector("#resume-file").value = "";
    showToast("Choose a PDF file to continue.");
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    document.querySelector("#resume-file").value = "";
    showToast("That PDF is over 10 MB. Choose a smaller file.");
    return;
  }
  document.querySelector("#upload-title").textContent = file.name;
  document.querySelector("#upload-hint").textContent = `${(file.size / (1024 * 1024)).toFixed(1)} MB selected`;
  document.querySelector("#file-status").textContent = "Selected in this browser only. PDF text extraction is not connected yet.";
  setMessage("#form-message", "PDF selected. Add the skills you want to compare.");
}

function openAuth(mode = "login") {
  setAuthMode(mode);
  document.querySelector("#auth-error").textContent = "";
  authDialog.showModal();
}

function setAuthMode(mode) {
  authMode = mode;
  const registering = mode === "register";
  document.querySelectorAll(".auth-tab").forEach((tab) => {
    const active = tab.dataset.authMode === mode;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  document.querySelector("#auth-title").textContent = registering ? "Start with a clear view." : "Welcome back.";
  document.querySelector("#auth-copy").textContent = registering ? "Create your private workspace and keep your role comparisons." : "Sign in to pick up where your career thinking left off.";
  document.querySelector("#auth-name").hidden = !registering;
  document.querySelector(".auth-name-label").hidden = !registering;
  document.querySelector("#auth-name").required = registering;
  document.querySelector("#auth-password").autocomplete = registering ? "new-password" : "current-password";
  document.querySelector("#auth-submit span:first-child").textContent = registering ? "Create account" : "Sign in";
  document.querySelector("#auth-error").textContent = "";
}

async function saveMatch() {
  if (!lastAnalysis) return;
  if (!currentUser) {
    pendingSave = lastAnalysis;
    openAuth("register");
    return;
  }
  try {
    await api("/api/matches", { method: "POST", body: JSON.stringify(lastAnalysis) });
    await refreshMatches();
    document.querySelector("#save-match-button").hidden = true;
    showToast("Match saved to your library.");
  } catch (error) {
    showToast(error.message);
  }
}

async function restoreSession() {
  try {
    currentUser = await api("/api/auth/me");
    savedMatches = await api("/api/matches");
  } catch {
    currentUser = null;
    savedMatches = [];
  }
  setAuthenticationUI();
}

document.querySelectorAll(".side-nav .nav-item").forEach((item) => {
  item.addEventListener("click", (event) => {
    event.preventDefault();
    switchView(item.dataset.view);
  });
});

document.addEventListener("click", (event) => {
  const viewButton = event.target.closest("[data-view-target]");
  if (viewButton) switchView(viewButton.dataset.viewTarget);
  const authButton = event.target.closest("[data-auth-open]");
  if (authButton) openAuth(authButton.dataset.authOpen);
});

document.querySelector("#auth-open").addEventListener("click", () => {
  if (currentUser) switchView("account");
  else openAuth("login");
});

document.querySelector("#sidebar-account").addEventListener("click", () => {
  if (currentUser) switchView("account");
  else openAuth("register");
});

document.querySelectorAll(".auth-tab").forEach((tab) => {
  tab.addEventListener("click", () => setAuthMode(tab.dataset.authMode));
});

document.querySelector("#auth-close").addEventListener("click", () => authDialog.close());
authDialog.addEventListener("click", (event) => {
  if (event.target === authDialog) authDialog.close();
});

document.querySelector("#auth-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const registering = authMode === "register";
  const payload = {
    email: document.querySelector("#auth-email").value.trim(),
    password: document.querySelector("#auth-password").value,
  };
  if (registering) payload.full_name = document.querySelector("#auth-name").value.trim();
  const submitButton = document.querySelector("#auth-submit");
  submitButton.disabled = true;
  document.querySelector("#auth-error").textContent = "";
  try {
    currentUser = await api(registering ? "/api/auth/register" : "/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    savedMatches = await api("/api/matches");
    setAuthenticationUI();
    authDialog.close();
    document.querySelector("#auth-form").reset();
    showToast(registering ? "Your workspace is ready." : "Welcome back.");
    if (pendingSave) {
      lastAnalysis = pendingSave;
      pendingSave = null;
      await saveMatch();
    }
  } catch (error) {
    document.querySelector("#auth-error").textContent = error.message;
  } finally {
    submitButton.disabled = false;
  }
});

document.querySelector("#logout-button").addEventListener("click", async () => {
  try {
    await api("/api/auth/logout", { method: "POST" });
  } catch (error) {
    showToast(error.message);
  }
  currentUser = null;
  savedMatches = [];
  setAuthenticationUI();
  switchView("overview");
  showToast("You have signed out.");
});

document.querySelector("#profile-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser) return;
  const payload = {
    full_name: document.querySelector("#profile-name").value.trim(),
    resume_skills: document.querySelector("#profile-skills").value.split(/[,;\n]/).map((skill) => skill.trim()).filter(Boolean),
  };
  try {
    currentUser = await api("/api/profile", { method: "PUT", body: JSON.stringify(payload) });
    resumeSkills.value = currentUser.resume_skills.join(", ");
    setAuthenticationUI();
    setMessage("#profile-message", "Your profile has been saved.");
  } catch (error) {
    setMessage("#profile-message", error.message, true);
  }
});

document.querySelector("#analyze-button").addEventListener("click", analyzeMatch);
document.querySelector("#save-match-button").addEventListener("click", saveMatch);

document.querySelector("#sample-button").addEventListener("click", () => {
  resumeSkills.value = currentUser?.resume_skills?.length ? currentUser.resume_skills.join(", ") : "Python, FastAPI, SQL, Git, Docker";
  document.querySelector("#job-title").value = "Backend engineer";
  document.querySelector("#company-name").value = "Northstar Labs";
  jobDescription.value = "We are hiring a backend engineer to build REST API services with Python and FastAPI. You will work with PostgreSQL, Docker, AWS and Machine Learning, collaborating with product and data teams.";
  document.querySelector("#character-count").textContent = `${jobDescription.value.length} characters`;
  setMessage("#form-message", "Example loaded. Analyze it to see a sample result.");
  jobDescription.focus();
});

jobDescription.addEventListener("input", () => {
  const count = jobDescription.value.length;
  document.querySelector("#character-count").textContent = `${count} character${count === 1 ? "" : "s"}`;
});

document.querySelector("#resume-file").addEventListener("change", (event) => updateFile(event.target.files[0]));

document.querySelector("#upload-zone").addEventListener("dragover", (event) => {
  event.preventDefault();
  event.currentTarget.classList.add("dragover");
});

document.querySelector("#upload-zone").addEventListener("dragleave", (event) => event.currentTarget.classList.remove("dragover"));
document.querySelector("#upload-zone").addEventListener("drop", (event) => {
  event.preventDefault();
  event.currentTarget.classList.remove("dragover");
  updateFile(event.dataTransfer.files[0]);
});

async function handleMatchAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const match = savedMatches.find((savedMatch) => String(savedMatch.id) === button.dataset.matchId);
  if (!match) return;
  if (button.dataset.action === "delete") {
    try {
      await api(`/api/matches/${match.id}`, { method: "DELETE" });
      savedMatches = savedMatches.filter((savedMatch) => savedMatch.id !== match.id);
      renderWorkspace();
      showToast("Match removed from your library.");
    } catch (error) {
      showToast(error.message);
    }
    return;
  }
  resumeSkills.value = match.resume_skills.join(", ");
  document.querySelector("#job-title").value = match.job_title;
  document.querySelector("#company-name").value = match.company;
  jobDescription.value = match.job_description;
  document.querySelector("#character-count").textContent = `${jobDescription.value.length} characters`;
  analyzeMatch();
  switchView("matcher");
}

document.querySelector("#saved-list").addEventListener("click", handleMatchAction);
document.querySelector("#dashboard-recent").addEventListener("click", handleMatchAction);

document.querySelector("#help-button").addEventListener("click", () => {
  showToast("Accounts and saved matches use your local SQLite database. PDF text extraction is not connected yet.");
});

restoreSession();