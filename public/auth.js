//const supabaseUrl = 'https://wvyveuuneltqddjtnemc.supabase.co';
const supabaseUrl = 'https://ahpmasoevxtpblitjjxd.supabase.co';
//const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2eXZldXVuZWx0cWRkanRuZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUzMjI2NTgsImV4cCI6MjA2MDg5ODY1OH0.n6rJ0XSOgPOkBZajHAEXvOYcUg7qiHOTf-2EyrHrmbk';
const supabaseKey =   'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFocG1hc29ldnh0cGJsaXRqanhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyMzQ0ODIsImV4cCI6MjA5OTgxMDQ4Mn0.LtPmVvAoDQFAuSmBNQpIYNi4xXOGOVzfItfrjhqCcYE';


const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
document.addEventListener('DOMContentLoaded', async()=> {
    const isIndexPage = window.location.pathname.endsWith('index.html')|| window.location.pathname.endsWith('/');
    const isLoginPage = window.location.pathname.endsWith('login.html');
    const{data:{user}} = await supabase.auth.getUser();
    if(user){
        if(isLoginPage){
            window.location.href = 'index.html'; 
        }
        console.log("Logged in as:", user.email);
    }else{
        if(isIndexPage){
            window.location.href = 'login.html';
        }
        console.log("Not logged in");
    }
    if(isLoginPage){
        setupAuthTabs();
        setupAuthForms();
    }
});
function setupAuthTabs(){
    const loginTab = document.getElementById('login-tab');
    const signupTab = document.getElementById('signup-tab');
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');

    loginTab.addEventListener('click', () =>{
        loginTab.classList.add('active');
        signupTab.classList.remove('active');
        loginForm.classList.add('active');
        signupForm.classList.remove('active');
    });

    signupTab.addEventListener('click', () => {
        signupTab.classList.add('active');
        loginTab.classList.remove('active');
        signupForm.classList.add('active');
        loginForm.classList.remove('active');
    });
}
function setupAuthForms(){
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const loginError = document.getElementById('login-error');
    const signupError = document.getElementById('signup-error');
    loginForm.addEventListener('submit', async(e)=>{
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        try{
            loginError.textContent='';
            const{data,error}=await supabase.auth.signInWithPassword({email,password});
            if(error)throw error;
            window.location.href='index.html';
        }catch(error){
            console.error("Error logging in:", error.message);
            loginError.textContent=error.message||'Failed to log in. Please try again.'
        }
    });
    signupForm.addEventListener('submit',async(e)=>{
        e.preventDefault();
        const username = document.getElementById('signup-username').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        try{
            signupError.textContent='';
            const{data,error}=await supabase.auth.signUp({
                email,
                password,
                options: {data:{username}}
            });
            if(error)throw error;
            if(data.user){
                if(data.session){
                    window.location.href='index.html';
                }else{
                    signupForm.innerHTML=`<div class="success-message">
                    <h3>Registration Successful</h3>
                    <p>Please check your email to confirm your account before logging in.</p>
                    <button class="auth-submit" onclick="document.getElementById('login-tab').click()">
                        Go to Login
                    </button>
                </div>`;
               }
            }
        }catch(error){
            console.error('Error signing up:', error.message);
            signupError.textContent=error.message||'Failed to sign up. Please try again.'
        }
    });
}
async function logout() {
    try{
        const{error}=await supabase.auth.signOut();
        if(error) throw error;
        window.location.href='login.html';
    }catch(error){
        console.error('Error logging out:', error.message);
        alert('Failed to log out. Please try again.')
    }
}
window.logout=logout;