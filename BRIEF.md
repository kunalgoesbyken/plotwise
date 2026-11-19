# Brief (verbatim, from start_assignment)

Started: 2026-11-19T16:43:37Z (UTC). Deadline: 2026-11-21T16:43:37Z (UTC).

---

# Generalist Assignment

General Machines · Founding Team Engineer, Generalist

## Who we are

General Machines is an applied AI research lab. We build open datasets, evals and small models for AI agents, for frontier labs and applied teams. Our first release, CartTrace-100k, has 101,416 journeys of an AI shopping agent through checkout and payment.

We work closely with Silicon Bricks, which makes real estate software from plot to building. The problem below is a project they're working on right now.

## The role

**Founding Team Engineer, Generalist.** Part entrepreneur-in-residence, part builder. You take whole projects from a messy start to something shipped.

- You are very AI-native. Agents are how you work every day.
- You get up to speed on new contexts fast, and go deep, not just wide.
- You own projects end to end, and can juggle several at once.
- You want to work at founding-team intensity.

## What you'll be working on

The work changes every few weeks. Right now it includes:

- **3D and vision models:** turning plans, photos and site data into 3D buildings and scenes.
- **Diffusion models:** image and 3D generation, used inside real products.
- **Local and open-source models:** running, fine-tuning and evaluating them on our own machines.
- **Datasets and evals for agents:** like CartTrace-100k.

## 1. Constraints

| | |
|---|---|
| **Time** | 48 hours, from the moment you started. The clock runs on our server, and it stops accepting submissions at your deadline. |
| **Tools** | Anything is fair game, as long as the result runs in a browser. |
| **Questions** | We won't answer any. Make a call and write it down. |
| **Submit** | One doc, submitted through this MCP server with the `submit_application` tool. What goes in the doc is in section 5. The doc and every link in it must be viewable by anyone with the link. No email. |
| **Location** | Bangalore / hybrid |
| **Payment** | This assignment is unpaid. |

## 2. The problem

A real estate developer in Bangkok owns a plot. Before paying an architect, they want to know what they can build on it: how big, how tall, and what it might look like.

The answer depends on building regulations that change by zone. In Bangkok these are spread across separate documents, often only in Thai.

You don't need to know architecture or Thai building law going in.

## 3. What to build

A tool. Given a plot and a building type, it shows what's allowed and the concept designs that fit, in 3D.

- **Input:** the plot, its location or zone, the road it faces, and a building type (for example, a condo).
- **Output:** the rules that apply, such as floor area ratio, open space, setbacks and height. The space the building is allowed to fill. At least two designs that fit, each with a pass/fail checklist.
- **Scope:** one zone in Bangkok, done properly.

You have 48 hours, so we expect real execution, not a prototype:

- **Any plot shape:** the plot is drawn on a map. Real plots are rarely rectangles.
- **Accurate:** the allowed space follows the plot's real outline, each rule visibly changes it, and the floor areas add up.
- **Real site:** the plot sits in 3D among the actual buildings and roads around it, not on an empty grid.
- **Live:** change the plot, the road or the building type, and everything updates at once, with no reload.
- **Finished:** it runs smoothly on a normal laptop, and looks like something you could put in front of a client.

## 4. How we judge

| | |
|---|---|
| **Thinking** | How you think through a domain you've never seen: how deep your research went, and the calls you made where things were unclear. |
| **Working with AI** | How you work with AI from the first session. |
| **Execution** | How well the tool is built: accurate, on the real site, live, and finished. We will try to break it. |
| **Decisions and writing** | Clear, specific reasons for your choices, in few words. |

## 5. What to submit

One doc (Google Doc, Notion or similar), with these seven parts in this order. All seven are required.

| # | Part | What it is |
|---|---|---|
| 1 | Live link | The tool, open to anyone with the link. |
| 2 | Repo | The code. |
| 3 | One-pager | Your write-up, written in the doc. Details below. |
| 4 | Transcripts | Links to your AI sessions, from the very first one. Details below. |
| 5 | Your setup | Six short answers, written in the doc. Details below. |
| 6 | Your best project | One link to the most complete project you've owned end to end, and a line on which parts were yours. |
| 7 | About you | A short intro and your links. Details below. |

### Part 3: the one-pager

One page of the doc, with these four headings. We read it as closely as we use the tool.

1. **What you understood.**
2. **What you did, and why.**
3. **Technical decisions, and why.** The stack, how you work out the allowed space, where the site data comes from, and how you kept it smooth.
4. **What's still wrong, and what you'd do next.**

### Part 4: the transcripts

- Two or three raw, unedited transcripts of your first sessions with AI, starting with the one where you connected to our MCP server and started the assignment, through your research and planning. Not a summary, and not your coding sessions. Link each one from the doc.
- A short note above the links: what did the AI miss, and how did you know it was missing? What made you catch it, and how did you research it?

### Part 5: your setup

A few lines each. Name real tools and real numbers.

1. What tools, models and agents do you use day to day, and for what?
2. How do you run them? Parallel sessions, rules files, skills, MCP servers, automations.
3. Roughly how many tokens, or how much money, do you spend a month?
4. What's the most ambitious thing you've built mostly with AI? Add a link. Where did the AI break?
5. How do you get up to speed on a codebase or domain you've never seen?
6. Have you worked with 3D, vision, diffusion, local or open-source models? Say what you did.

### Part 7: about you

The basics, kept short. We'll get to know you properly in the interview.

- **Who you are:** a few lines on what you've done so far and what you're doing now.
- **Your links:** résumé, LinkedIn, GitHub, and a portfolio or personal site if you have one.
- **Projects:** links to anything else you've built that you want us to see.
- **Anything else:** whatever you'd like us to know. Optional.

## 6. How to submit

Call `submit_application` on this server with your details, the doc's link, the same live link and repo link that are in the doc, and your résumé link.

- The server opens these four links. If one needs a sign-in or doesn't exist, the submission is rejected with the reason, and you can fix it and call the tool again.
- A successful call returns a receipt ID. Keep it. `check_submission` confirms what we have on record.
- You can resubmit until your 48 hours are up. We read the latest one. After your deadline the server rejects submissions.
- `time_left` shows how much of your 48 hours remains, at any point.
- The write-up is yours to write. Your agent can submit it, not author it.

## What happens next

A live call where you walk us through it, show your setup, and take a new requirement on the spot.
