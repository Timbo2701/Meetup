const AUTH_PROFILE_KEY = "local-meetup-auth-profile-v1";
const AUTH_PERSON_ID = "local-user";

let authProfile = loadAuthProfile();
let pendingAvatar = authProfile?.avatar || "";
let originalCreateAvatar = null;
let originalUpdateProfileButton = null;

initAuth();

function initAuth() {
  installProfilePerson();
  installAvatarOverride();
  installProfileButtonOverride();
  createAuthDialog();
  applyProfile(authProfile);

  window.setTimeout(() => {
    if (!authProfile) {
      openAuthDialog(true);
    }
  }, 250);
}

function loadAuthProfile() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_PROFILE_KEY) || "null");
  } catch {
    return null;
  }
}

function saveAuthProfile(profile) {
  authProfile = profile;
  localStorage.setItem(AUTH_PROFILE_KEY, JSON.stringify(profile));
}

function installProfilePerson() {
  const existing = people.find((person) => person.id === AUTH_PERSON_ID);
  const person = existing || {
    id: AUTH_PERSON_ID,
    name: "Du",
    initials: "DU",
    bg: "#6ea58f",
    fg: "#ecfff5",
    shirt: "#17211d",
  };

  if (!existing) {
    people.unshift(person);
  }
}

function installAvatarOverride() {
  if (originalCreateAvatar) {
    return;
  }

  originalCreateAvatar = createAvatar;
  createAvatar = function createAuthAwareAvatar(person, size = "medium") {
    if (person?.avatar) {
      const img = document.createElement("img");
      img.className = `avatar avatar-${size} avatar-custom`;
      img.src = person.avatar;
      img.alt = person.name || "Profil";
      img.loading = "lazy";
      return img;
    }

    return originalCreateAvatar(person, size);
  };
}

function installProfileButtonOverride() {
  if (originalUpdateProfileButton) {
    return;
  }

  originalUpdateProfileButton = updateProfileButton;
  updateProfileButton = function updateAuthProfileButton() {
    originalUpdateProfileButton();
    const profile = getAuthPerson();
    if (profileButton && profile) {
      profileButton.innerHTML = "";
      profileButton.append(createAvatar(profile, "profile"));
      profileButton.title = `Profil: ${profile.name}`;
      profileButton.setAttribute("aria-label", `Profil: ${profile.name}`);
    }
  };

  profileButton.addEventListener(
    "click",
    (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      openAuthDialog(false);
    },
    true,
  );
}

function applyProfile(profile) {
  const person = getAuthPerson();
  const name = profile?.name?.trim() || "Du";
  person.name = name;
  person.initials = getInitials(name);
  person.avatar = profile?.avatar || "";
  person.bio = profile?.bio || "";

  state.profileId = AUTH_PERSON_ID;
  localStorage.setItem(PROFILE_KEY, AUTH_PERSON_ID);
  updateProfileButton();
  render();
}

function getAuthPerson() {
  return people.find((person) => person.id === AUTH_PERSON_ID);
}

function createAuthDialog() {
  if (document.querySelector("#authDialog")) {
    return;
  }

  const dialog = document.createElement("dialog");
  dialog.className = "auth-dialog";
  dialog.id = "authDialog";
  dialog.innerHTML = `
    <form class="auth-panel" id="authForm" method="dialog">
      <div class="auth-header">
        <div>
          <p class="eyebrow">Dein Account</p>
          <h2>Profil erstellen</h2>
        </div>
        <button class="auth-close" id="authCloseButton" type="button" aria-label="Schliessen">X</button>
      </div>

      <div class="auth-avatar-row">
        <div class="auth-avatar-preview" id="authAvatarPreview"></div>
        <div class="auth-avatar-actions">
          <label class="auth-file-button">
            Profilbild
            <input id="authAvatarInput" type="file" accept="image/*">
          </label>
          <p class="auth-hint">Wird nur lokal auf diesem iPhone gespeichert.</p>
        </div>
      </div>

      <label>
        Name
        <input id="authNameInput" maxlength="32" required placeholder="Dein Name">
      </label>

      <label>
        Kurzinfo
        <textarea id="authBioInput" maxlength="90" rows="3" placeholder="z.B. Kaffee, Basketball, neue Leute"></textarea>
      </label>

      <div class="auth-actions">
        <button class="auth-save" type="submit">Profil speichern</button>
      </div>
    </form>
  `;
  document.body.append(dialog);

  const form = dialog.querySelector("#authForm");
  const closeButton = dialog.querySelector("#authCloseButton");
  const avatarInput = dialog.querySelector("#authAvatarInput");

  dialog.addEventListener("cancel", (event) => {
    if (!authProfile) {
      event.preventDefault();
    }
  });

  closeButton.addEventListener("click", () => {
    if (authProfile) {
      dialog.close();
    }
  });

  avatarInput.addEventListener("change", async () => {
    const file = avatarInput.files?.[0];
    if (!file) {
      return;
    }

    pendingAvatar = await resizeImage(file);
    renderAuthPreview();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = document.querySelector("#authNameInput").value.trim();
    if (!name) {
      document.querySelector("#authNameInput").focus();
      return;
    }

    const profile = {
      name,
      bio: document.querySelector("#authBioInput").value.trim(),
      avatar: pendingAvatar,
      updatedAt: new Date().toISOString(),
    };
    saveAuthProfile(profile);
    applyProfile(profile);
    dialog.close();
  });
}

function openAuthDialog(required) {
  const dialog = document.querySelector("#authDialog");
  const closeButton = document.querySelector("#authCloseButton");
  const title = dialog.querySelector("h2");

  pendingAvatar = authProfile?.avatar || "";
  title.textContent = authProfile ? "Profil bearbeiten" : "Profil erstellen";
  closeButton.style.visibility = required ? "hidden" : "visible";
  document.querySelector("#authNameInput").value = authProfile?.name || "";
  document.querySelector("#authBioInput").value = authProfile?.bio || "";
  renderAuthPreview();
  dialog.showModal();
  document.querySelector("#authNameInput").focus();
}

function renderAuthPreview() {
  const preview = document.querySelector("#authAvatarPreview");
  const name = document.querySelector("#authNameInput")?.value || authProfile?.name || "Du";

  preview.innerHTML = "";
  if (pendingAvatar) {
    const img = document.createElement("img");
    img.src = pendingAvatar;
    img.alt = "Profilbild";
    preview.append(img);
    return;
  }

  const person = {
    name,
    initials: getInitials(name),
    bg: "#6ea58f",
    fg: "#ecfff5",
    shirt: "#17211d",
  };
  const img = originalCreateAvatar(person, "profile");
  preview.append(img);
}

function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const image = new Image();
      image.onerror = reject;
      image.onload = () => {
        const maxSize = 420;
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function getInitials(name) {
  const parts = String(name || "Du")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  return (parts.map((part) => part[0]).join("") || "DU").toUpperCase();
}
