import { useState } from "react";
import Header from "./components/Header";
import GroupsPage from "./pages/GroupsPage";
import GroupDetailPage from "./pages/GroupDetailPage";

export default function App() {
  const [selectedGroupId, setSelectedGroupId] = useState(null);

  return (
    <div className="min-h-screen">
      <Header
        crumb={selectedGroupId ? "Group" : null}
        onHome={() => setSelectedGroupId(null)}
      />
      {selectedGroupId ? (
        <GroupDetailPage groupId={selectedGroupId} />
      ) : (
        <GroupsPage onOpenGroup={setSelectedGroupId} />
      )}
    </div>
  );
}
