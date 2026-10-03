const API_URL = "https://resumeiq-backend-hozi.onrender.com";

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");

const loginTab = document.getElementById("loginTab");
const registerTab = document.getElementById("registerTab");

const message = document.getElementById("message");


function showLogin() {

    loginForm.classList.remove("hidden");
    registerForm.classList.add("hidden");

    loginTab.classList.add("active");
    registerTab.classList.remove("active");

    clearMessage();
}


function showRegister() {

    loginForm.classList.add("hidden");
    registerForm.classList.remove("hidden");

    loginTab.classList.remove("active");
    registerTab.classList.add("active");

    clearMessage();
}


function showMessage(text, type) {

    message.innerHTML = "";

    const box = document.createElement("div");

    box.className = `message ${type}`;

    box.textContent = text;

    message.appendChild(box);
}


function clearMessage() {

    message.innerHTML = "";
}


function redirectByRole(role) {

    if (role === "recruiter") {

        window.location.href = "recruiter.html";

    } else {

        window.location.href = "index.html";

    }
}


loginForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    const email =
        document.getElementById("loginEmail").value.trim();

    const password =
        document.getElementById("loginPassword").value;

    const button =
        loginForm.querySelector("button");

    button.disabled = true;
    button.textContent = "Logging in...";

    clearMessage();


    try {

        const response = await fetch(
            `${API_URL}/login`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    email: email,
                    password: password
                })
            }
        );


        const data = await response.json();


        if (!response.ok) {

            showMessage(
                data.detail ||
                "Invalid email or password.",
                "error"
            );

            return;
        }


        localStorage.setItem(
            "token",
            data.token
        );


        localStorage.setItem(
            "role",
            data.user.role
        );


        localStorage.setItem(
            "userName",
            data.user.name
        );


        showMessage(
            "Login successful. Redirecting...",
            "success"
        );


        setTimeout(() => {

            redirectByRole(
                data.user.role
            );

        }, 500);


    } catch (error) {

        showMessage(
            "Could not connect to the backend.",
            "error"
        );

    } finally {

        button.disabled = false;
        button.textContent = "Login";

    }

});


registerForm.addEventListener("submit", async (event) => {

    event.preventDefault();


    const name =
        document.getElementById("registerName").value.trim();

    const email =
        document.getElementById("registerEmail").value.trim();

    const password =
        document.getElementById("registerPassword").value;


    const selectedRole =
        document.querySelector(
            'input[name="role"]:checked'
        );


    const role =
        selectedRole
            ? selectedRole.value
            : "candidate";


    const button =
        registerForm.querySelector("button");


    button.disabled = true;
    button.textContent = "Creating Account...";

    clearMessage();


    try {

        const response = await fetch(
            `${API_URL}/register`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    name: name,
                    email: email,
                    password: password,
                    role: role
                })
            }
        );


        const data = await response.json();


        if (!response.ok) {

            showMessage(
                data.detail ||
                "Registration failed.",
                "error"
            );

            return;
        }


        localStorage.setItem(
            "token",
            data.token
        );


        localStorage.setItem(
            "role",
            data.user.role
        );


        localStorage.setItem(
            "userName",
            data.user.name
        );


        showMessage(
            "Account created successfully. Redirecting...",
            "success"
        );


        setTimeout(() => {

            redirectByRole(
                data.user.role
            );

        }, 500);


    } catch (error) {

        showMessage(
            "Could not connect to the backend.",
            "error"
        );

    } finally {

        button.disabled = false;
        button.textContent = "Create Account";

    }

});
