import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { Copy, Users, Plus } from "lucide-react";

export default function Teams() {
  return (
    <div className="app"><Sidebar/><main className="main">
      <Topbar title="Teams" description="Manage teams, members and invitations."/>
      <div className="team-toolbar"><div><h2>Your Teams</h2><p>86 teams across your active events</p></div><button className="create-button"><Plus size={18}/>Create Team</button></div>
      <div className="team-grid">
        <div className="team-card"><div className="team-header"><div className="team-icon">AI</div><div><h3>Neural Labs</h3><span>AI Innovation Challenge</span></div><span className="team-status">Complete</span></div>
          <div className="members"><div className="member-avatar">IN</div><div className="member-avatar">RJ</div><div className="member-avatar">DH</div><div className="member-avatar">+2</div></div>
          <div className="invite-box"><span>Invite Code</span><strong>DF-AI82K</strong><button><Copy size={15}/></button></div>
          <div className="team-footer"><span><Users size={15}/>5 members</span><button>Manage</button></div>
        </div>
      </div>
    </main></div>
  );
}