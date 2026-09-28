import { Trophy, Mail, Lock, ArrowRight } from "lucide-react";

export default function Login() {
  return (
    <div className="login-page"><div className="login-card">
      <div className="login-logo"><Trophy size={23}/></div><h1>Welcome back</h1><p>Sign in to manage your hackathon workspace.</p>
      <form><label>Email</label><div className="input-icon"><Mail size={17}/><input type="email" placeholder="you@example.com"/></div>
        <label>Password</label><div className="input-icon"><Lock size={17}/><input type="password" placeholder="••••••••"/></div>
        <button className="login-button">Sign in <ArrowRight size={18}/></button>
      </form>
      <div className="login-footer">DogFood Hackathon OS · Open Source</div>
    </div></div>
  );
}