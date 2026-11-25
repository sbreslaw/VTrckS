# specs/ — approved acceptance criteria, one file per issue

**For reporters and approvers (3 sentences).** After you file an issue, triage writes the acceptance criteria into `specs/GH-<issue>.md` and opens a pull request with just that file; you receive a "review requested" email. Open it, read the one page, click **Review changes → Approve → Submit** if it says what you asked for — or click a line and comment if it does not. Work on the issue starts only after approval; **no review within 2 business days counts as approved by default**, and the approved file is what the change will be tested against.

**The rule the project runs on.** The issue plus its approved spec are the complete specification. Explanations given in calls, Teams or email bind nobody until they are in the issue. A test failure against an item in the approved spec is an implementation defect (`rework:implementation`); a failure on something the spec does not say is a new request (`rework:requirement-gap`) and becomes a new issue; an item both sides read differently is `rework:ambiguous-acceptance` and gets rewritten. Reworks are reported by cause.

**When you reopen an issue after testing**, use "Reopen with comment" and this shape, so the cause can be attributed:

```
Verification — FAILED
Tested on: DH1, PR #<n>, <date>
What I did: <steps, order type, synthetic document number>
Which approved acceptance item failed: <number from specs/GH-<n>.md, or "not in the spec">
What I saw: <the gap>
Still working: <what passes>
Screenshots: <attached>
```

**Who approves** is chosen on the issue form ("Approver") and named in the spec pull request (`Approver: @login`); you are @-mentioned there and GitHub emails you the link. Only that person's Approve counts (or a repository collaborator's). No repository role is needed — a GitHub account is enough. Blank or missing on the form → the per-category default in `APPROVERS.md`.

Spec files are plain Markdown: Request (as filed), Acceptance (numbered), Out of scope, Open questions with the default applied if unanswered. They stay here permanently next to the code they govern; the implementation pull request quotes the approved file as its definition of done.

**Self-approval.** When the issue's Approver is the same person who triages it and opens the spec PR (e.g. *Reporter (me)* on an issue the owner filed), the gate confirms acceptance the moment the spec PR is opened — no review and no 2-business-day hold. The spec file still exists and the implementation PR still carries it unchanged.
