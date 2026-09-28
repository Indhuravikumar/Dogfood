import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import StatCard from "../components/StatCard";
import { CalendarDays, Users, FileCheck, Trophy, ArrowUpRight, Clock } from "lucide-react";

export default function Dashboard() {
  return (
    <div className="app">
      <Sidebar/>
      <main className="main">
        <Topbar title="Good evening, Indhu 👋" description="Here's what's happening across your hackathons."/>
        <section className="stats-grid">
          <StatCard title="Active Events" value="04" change="+2 this month" icon={<CalendarDays size={20}/>}/>
          <StatCard title="Participants" value="1,284" change="+18.4% this month" icon={<Users size={20}/>}/>
          <StatCard title="Submissions" value="326" change="+12.8% this month" icon={<FileCheck size={20}/>}/>
          <StatCard title="Teams" value="218" change="+9.2% this month" icon={<Trophy size={20}/>}/>
        </section>
        <section className="dashboard-grid">
          <div className="panel">
            <div className="panel-header"><div><h3>Active Hackathons</h3><p>Monitor your ongoing events</p></div><button className="text-button">View all <ArrowUpRight size={15}/></button></div>
            {[
              ["AI","AI Innovation Challenge","324 participants · 86 teams","LIVE","2d 14h left","purple"],
              ["WD","Web3 Builders Sprint","186 participants · 42 teams","LIVE","5d 08h left","blue"],
              ["CL","Climate Tech Challenge","98 participants · 27 teams","UPCOMING","Starts Oct 04","orange"]
            ].map(e => (
              <div className="event-row" key={e[1]}>
                <div className={`event-logo ${e[5]}`}>{e[0]}</div>
                <div className="event-info"><strong>{e[1]}</strong><span>{e[2]}</span></div>
                <div className={`event-status ${e[3] === "LIVE" ? "live" : "upcoming"}`}>{e[3]}</div>
                <div className="event-date">{e[4]}</div>
              </div>
            ))}
          </div>
          <div className="panel">
            <div className="panel-header"><div><h3>Upcoming Deadlines</h3><p>Important event milestones</p></div><Clock size={19}/></div>
            {[
              ["AI Innovation Challenge","Project submission","Tomorrow"],
              ["Web3 Builders Sprint","Team formation closes","2 days"],
              ["Climate Tech Challenge","Registration opens","5 days"]
            ].map(d => (
              <div className="deadline" key={d[0]}>
                <div className="deadline-dot"/>
                <div><strong>{d[0]}</strong><span>{d[1]}</span></div><b>{d[2]}</b>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}