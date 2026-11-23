# grasp walkthrough

Plays a [grasp](https://github.com/mrgucci1/grasp) walkthrough beside your real code. A natural voice talks you through the change, and the editor follows it:

- **Opens each stop's file** as the walkthrough reaches it, and switches files when it steps into a method and back out.
- **Lights up the lines being discussed**, fades the rest, and boxes each identifier the voice names.
- **Labels the path** beside the code: where data comes in (◀), where it leaves (▶), and pinned notes (●). New lines get a green mark in the gutter.
- **Shows removed code** in the panel, since an editor can't show lines that are gone, and marks where they used to be.

The panel beside the editor has the player, word-by-word subtitles, definitions that pop up as each term is spoken, the transcript, the call stack, the decisions and the risks.

## Opening a walkthrough

- **From grasp:** step 3 (`/grasp-explain`) opens VS Code on the repo and starts playing. Nothing to do.
- **By hand:** run **grasp: Open Walkthrough…** from the Command Palette and pick one. The list shows the walkthroughs under `~/.grasp`, newest first.

## Controls

| | |
|---|---|
| Play or pause | the status bar item, Ctrl+Alt+Space, or Space in the panel |
| Previous or next sentence | `[` `]` in the panel, or **grasp: Previous/Next Sentence** |
| Previous or next stop | `←` `→` in the panel, or **grasp: Previous/Next Stop** |
| Close | close the panel, or **grasp: Close Walkthrough** |

## Settings

- `grasp.autoplay` (default on): start talking when grasp opens a walkthrough.
- `grasp.dimOtherLines` (default on): fade the lines the voice isn't on.
- `grasp.home`: where grasp keeps its walkthroughs, if not `$GRASP_HOME` or `~/.grasp`.

Colours follow your theme. Override them in `workbench.colorCustomizations` with the `grasp.*` keys.

Everything runs on this machine. The voice clips are made locally by grasp's bundled voice (Kokoro), and the extension sends nothing anywhere.
