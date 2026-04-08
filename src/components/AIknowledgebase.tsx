export const AIKnowledgeBase = {
  osName: "VC.os",
  version: "1.0.0",
  apps: {
    sys: {
      description: "System settings and configuration.",
      controls: "Click to open, use mouse to toggle settings.",
      purpose: "Modify OS behavior and appearance."
    },
    fileman: {
      description: "File manager for browsing system directories.",
      controls: "Click to open, use mouse to navigate folders.",
      purpose: "Access and manage system files."
    },
    docs: {
      description: "Document viewer.",
      controls: "Click to open, use mouse to scroll.",
      purpose: "Read system documentation and readme files."
    },
    store: {
      description: "Application store.",
      controls: "Click to open, click install buttons.",
      purpose: "Download and install new games or utilities."
    },
    search: {
      description: "Web browser.",
      controls: "Click to open, type in address bar.",
      purpose: "Browse the web."
    },
    linux: {
      description: "Terminal emulator.",
      controls: "Click to open, type commands.",
      purpose: "Execute system-level commands."
    }
  },
  games: {
    snake: {
      controls: "Arrow keys (Up, Down, Left, Right).",
      goal: "Eat the food, avoid walls and self."
    },
    pong: {
      controls: "Arrow keys (Up, Down) to move paddle.",
      goal: "Deflect the ball past the opponent."
    },
    vc_doom: {
      controls: "Arrow keys (Up, Down, Left, Right) to move, Space to shoot.",
      goal: "Navigate and defeat enemies."
    },
    glitch_run: {
      controls: "Arrow keys (Up, Down, Left, Right), Space to jump.",
      goal: "Reach the end of the level."
    }
  },
  globalControls: {
    mouse: "Move to X/Y coordinates, click to focus or interact.",
    keyboard: "Arrow keys for navigation, Space for primary action.",
    windowManagement: "Click X to close, click title bar to move."
  }
};

export default AIKnowledgeBase;
