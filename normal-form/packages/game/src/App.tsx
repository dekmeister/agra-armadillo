import { MESSAGE_CATALOG } from "@normal-form/core";

// S1 placeholder shell. The Blueprint puzzle screen is built in S4/S5; for now
// this only proves the workspace graph (game -> core catalog) resolves and builds.
export function App() {
  const messages = Object.keys(MESSAGE_CATALOG.messages);
  return (
    <main style={{ fontFamily: "monospace", padding: 24, color: "#24435f" }}>
      <h1>Normal Form</h1>
      <p>Sequence Certification — scaffold. Catalog loaded:</p>
      <ul>
        {messages.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>
    </main>
  );
}
