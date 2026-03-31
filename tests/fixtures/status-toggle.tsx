"use client";

import { useState } from "react";

export function StatusToggle() {
  const [checkedIn, setCheckedIn] = useState(false);

  return (
    <div>
      <p>{checkedIn ? "Checked in" : "Not checked in"}</p>
      <button type="button" onClick={() => setCheckedIn(true)}>
        Check in
      </button>
    </div>
  );
}
