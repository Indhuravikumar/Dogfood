import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { FileText, Edit3, CheckCircle, Clock } from "lucide-react";

export default function Submissions() {
  const rows = [
    ["FarmGuard AI","Team Synkrons","submitted","2 hours ago"],
    ["CivicPulse","Code Catalysts","draft","35 min ago"]
  ];
  return (
    <div className="app"><Sidebar/><main className="main">
      <Topbar title="Submissions" description="Review and manage project submissions."/>
      <div className="submission-stats"><div><span>Total</span><strong>326</strong></div><div><span>Submitted</span><strong>281</strong></div><div><span>Drafts</span><strong>45</strong></div></div>
      <div className="submission-table">
        <div className="table-head"><span>PROJECT</span><span>TEAM</span><span>STATUS</span><span>UPDATED</span><span>ACTION</span></div>
        {rows.map(r => <div className="table-row" key={r[0]}>
          <div className="project-name"><div className="table-icon"><FileText size={17}/></div><strong>{r[0]}</strong></div>
          <span>{r[1]}</span>
          <span className={`status ${r[2]}`} >{r[2] === "submitted" ? <CheckCircle size={14}/> : <Clock size={14}/>} {r[2] === "submitted" ? "Submitted" : "Draft"}</span>
          <span>{r[3]}</span><button className="edit-button"><Edit3 size={15}/>Edit</button>
        </div>)}
      </div>
    </main></div>
  );
}