# Guardian Route

Build a modern, professional web application called:

"AI-Driven Self-Healing Network Route Planner"

PROJECT ABSTRACT:

Modern computer networks are vulnerable to router failures, link failures, congestion, high latency, and changing network conditions, which can interrupt communication and reduce network performance. This project proposes an AI-driven Self-Healing Network Route Planner that automatically detects network problems and selects reliable alternative routes with minimum service disruption.

The system represents the network as a weighted graph and uses Dijkstra's algorithm as a baseline for finding optimal-cost routes. A* Search provides goal-directed routing using heuristic information, while Beam Search maintains multiple promising backup routes for faster recovery. A Constraint Satisfaction Problem (CSP) module evaluates candidate routes based on constraints such as bandwidth, latency, hop count, and Quality of Service (QoS).

In addition, a Network Health Score is used to evaluate the overall quality and reliability of routes, while failure prediction identifies potentially unstable network components before complete failure occurs. Route diversity is incorporated to avoid backup paths that depend on the same critical routers or links, improving network resilience.

When a failure or high-risk condition is detected, the system automatically selects a suitable valid backup route and reroutes traffic, enabling self-healing with minimal downtime.

The proposed system should work as an interactive network simulation and visualization platform where users can create a network topology, simulate failures and congestion, select routing algorithms, observe alternative routes, and evaluate recovery performance.

MAIN GOAL:

Create an interactive network simulation dashboard that demonstrates how Dijkstra, A*, Beam Search, CSP, Network Health Score, Failure Prediction, Route Diversity, and automatic Self-Healing work together.

IMPORTANT:

Do NOT make this a simple static website.

It should look and behave like a real network monitoring and route-planning application.

--------------------------------------------------

1. HOME / LANDING PAGE

--------------------------------------------------

Create a professional landing page with:

Title:

"AI-Driven Self-Healing Network Route Planner"

Subtitle:

"Intelligent routing, predictive failure detection, and automatic network recovery."

Include a short explanation of the project.

Show the main features:

- Dijkstra Baseline Routing

- A* Heuristic Search

- Beam Search

- Constraint Satisfaction

- Network Health Score

- Failure Prediction

- Route Diversity

- Automatic Self-Healing

Add a prominent button:

"Launch Network Simulator"

Also include a simple visual representation of a network with routers and connections.

--------------------------------------------------

2. NETWORK SIMULATOR DASHBOARD

--------------------------------------------------

Create the main interactive dashboard.

The dashboard should contain:

LEFT SIDEBAR:

- Network Topology

- Routing Algorithms

- Constraints

- Failure Simulation

- Network Health

- Performance

- Self-Healing Logs

MAIN AREA:

A large interactive network graph.

Represent:

- Routers as nodes

- Links as edges

- Source node

- Destination node

- Active route

- Backup routes

- Failed routers

- Failed links

- Congested links

Use different visual states for:

- Healthy

- Warning

- Congested

- Failed

- Active route

- Backup route

Allow users to add/remove routers and links if possible.

--------------------------------------------------

3. SOURCE AND DESTINATION

--------------------------------------------------

Allow the user to select:

Source Router

Destination Router

Example:

Source: R1

Destination: R10

Show the currently selected route.

--------------------------------------------------

4. ROUTING ALGORITHM SECTION

--------------------------------------------------

Provide an algorithm selector:

- Dijkstra

- A*

- Beam Search

Each algorithm should have a short explanation.

Dijkstra:

"Baseline shortest/lowest-cost route finder."

A*:

"Goal-directed heuristic search using actual cost and estimated remaining cost."

Beam Search:

"Maintains multiple promising route candidates for faster recovery."

Allow the user to select one algorithm and run it.

Also provide an option:

"Compare Algorithms"

When selected, compare:

- Dijkstra

- A*

- Beam Search

Show:

- Route found

- Route cost

- Search time

- Nodes explored

- Number of candidate routes

- Whether the route satisfies constraints

--------------------------------------------------

5. DIJKSTRA

--------------------------------------------------

Implement or simulate Dijkstra's algorithm on the network graph.

Show:

- Selected route

- Total route cost

- Number of nodes explored

- Execution time

Use it as the baseline algorithm.

--------------------------------------------------

6. A* SEARCH

--------------------------------------------------

Implement or simulate A* Search.

Use:

f(n) = g(n) + h(n)

Where:

g(n) = actual cost from source to current node

h(n) = estimated cost from current node to destination

Display:

- g(n)

- h(n)

- f(n)

- Selected route

- Nodes explored

- Execution time

The heuristic should consider network-related factors where possible.

--------------------------------------------------

7. BEAM SEARCH

--------------------------------------------------

Implement or simulate Beam Search.

Allow the user to select Beam Width.

Example:

Beam Width:

2 / 3 / 4 / 5

Explain:

"Beam Search keeps only the most promising K candidates at each search stage."

Display:

- Candidate routes

- Candidate scores

- Beam width

- Routes retained

- Routes discarded

- Final route candidates

The purpose is to generate multiple promising backup routes efficiently.

--------------------------------------------------

8. CONSTRAINT SATISFACTION (CSP)

--------------------------------------------------

Create a constraint configuration panel.

Allow the user to define:

Minimum Bandwidth:

10 Mbps

Maximum Latency:

50 ms

Maximum Hop Count:

5

Maximum Packet Loss:

2%

Minimum Reliability:

90%

QoS Requirement:

Enabled

After routes are generated, CSP should check every candidate route.

Show:

Route

Bandwidth

Latency

Hop Count

Packet Loss

Reliability

QoS

Status

Use:

VALID

or

INVALID

Clearly explain why an invalid route was rejected.

Example:

Route R1 → R3 → R7 → R10

Bandwidth: 8 Mbps

Required: 10 Mbps

Status: INVALID

Reason: Insufficient bandwidth

--------------------------------------------------

9. NETWORK HEALTH SCORE

--------------------------------------------------

Create a Network Health Score from 0 to 100.

Example:

Network Health:

82 / 100

Calculate or simulate the score using factors such as:

- Latency

- Congestion

- Packet loss

- Reliability

- Link utilization

- Failure risk

Display individual factors.

Example:

Latency: 85%

Congestion: 70%

Reliability: 92%

Packet Loss: 95%

Failure Risk: 20%

Use a clear visual health indicator.

States:

90-100 = Healthy

70-89 = Warning

40-69 = Critical

0-39 = Severe

--------------------------------------------------

10. FAILURE PREDICTION

--------------------------------------------------

Create a failure prediction panel.

Show the health of individual routers and links.

Example:

Router R5

Latency: Increasing

Packet Loss: 6%

CPU/Load: 85%

Congestion: 78%

Failure Risk:

HIGH

Prediction:

"R5 may become unstable."

Use a simulated prediction model if a real ML model is not implemented.

The interface should clearly distinguish between:

Predicted Risk

and

Actual Failure

--------------------------------------------------

11. FAILURE SIMULATION

--------------------------------------------------

Allow the user to simulate real network problems.

Buttons:

- Fail Router

- Fail Link

- Increase Latency

- Increase Congestion

- Increase Packet Loss

- Restore Router

- Restore Link

When a router/link fails:

1. Mark it as failed.

2. Remove it from usable routing paths.

3. Detect the failure.

4. Generate alternative routes.

5. Run CSP.

6. Select the best valid route.

7. Automatically reroute traffic.

8. Show the recovery process.

--------------------------------------------------

12. ROUTE DIVERSITY

--------------------------------------------------

Implement route diversity.

Do not consider routes independent if they share the same critical router or link.

Example:

Primary:

R1 → R2 → R5 → R8

Backup:

R1 → R2 → R6 → R8

These routes share R1 → R2.

Therefore, give the backup route a diversity penalty.

Prefer:

Primary:

R1 → R2 → R5 → R8

Backup:

R1 → R3 → R6 → R8

Show:

Route Diversity Score

and

Shared Nodes/Links.

--------------------------------------------------

13. SELF-HEALING ENGINE

--------------------------------------------------

Create a central Self-Healing Engine.

Workflow:

Monitor Network

↓

Detect or Predict Failure

↓

Update Network Graph

↓

Generate Candidate Routes

↓

Dijkstra / A* / Beam Search

↓

CSP Constraint Validation

↓

Route Health Evaluation

↓

Route Diversity Evaluation

↓

Select Best Valid Route

↓

Automatically Reroute Traffic

↓

Update Network

↓

Network Recovered

Show this process visually in the dashboard.

--------------------------------------------------

14. ROUTE RANKING

--------------------------------------------------

After CSP validation, rank valid routes.

Use factors such as:

- Latency

- Bandwidth

- Congestion

- Hop count

- Reliability

- Failure risk

- Route diversity

Display a final ranking:

1. Route A — Score 92

2. Route B — Score 86

3. Route C — Score 78

Highlight the selected route.

--------------------------------------------------

15. PERFORMANCE COMPARISON

--------------------------------------------------

Create a comparison dashboard for:

Dijkstra

A*

Beam Search

Compare:

- Execution time

- Nodes explored

- Route cost

- Recovery time

- Memory/search effort if available

- Number of candidate routes

- Constraint satisfaction

- Success rate

Display the results using charts and tables.

--------------------------------------------------

16. SELF-HEALING EVENT LOG

--------------------------------------------------

Create a real-time event log.

Example:

[10:31:04] Network monitoring started

[10:31:10] Router R5 health decreased

[10:31:15] Failure risk: HIGH

[10:31:20] Router R5 FAILED

[10:31:21] Failure detected

[10:31:21] Generating alternative routes

[10:31:22] A* generated 4 candidates

[10:31:22] CSP rejected 2 routes

[10:31:23] Route diversity evaluated

[10:31:23] Backup route selected

[10:31:24] Traffic rerouted

[10:31:24] Network recovered

--------------------------------------------------

17. WHAT THE FINAL DEMO SHOULD SHOW

--------------------------------------------------

Create a demo scenario.

Initial network:

R1 → R2 → R5 → R10

Then simulate:

R5 FAILURE

The application should show:

R5 becomes RED

↓

Failure detected

↓

Original route becomes unavailable

↓

Dijkstra finds baseline alternative

↓

A* searches intelligently

↓

Beam Search generates multiple candidates

↓

CSP checks bandwidth/latency/hops/QoS

↓

Route Diversity checks shared components

↓

Health Score ranks routes

↓

Best valid route selected

↓

Traffic automatically switches

↓

Network status becomes HEALTHY

Show the complete process visually.

--------------------------------------------------

18. UI DESIGN

--------------------------------------------------

Use a modern professional technology/networking dashboard style.

Preferred design:

- Dark dashboard theme

- Modern cards

- Clean typography

- Interactive network graph

- Clear status indicators

- Professional charts

- Smooth animations

- Responsive design

Use colors meaningfully:

Green = Healthy

Yellow = Warning

Orange = Congested

Red = Failed

Blue = Active Route

Purple = Backup/Candidate Route

Do not make the interface overly colorful.

The design should look like a real network operations center (NOC) dashboard.

--------------------------------------------------

19. IMPORTANT TECHNICAL REQUIREMENTS

--------------------------------------------------

Make the application modular.

Separate:

1. Network topology management

2. Dijkstra

3. A* Search

4. Beam Search

5. CSP

6. Network Health Score

7. Failure Prediction

8. Route Diversity

9. Self-Healing Engine

10. Performance Monitoring

Use realistic simulated network data if real network hardware is not available.

The algorithms should operate on the same network graph so their results can be compared fairly.

Make the application interactive rather than a collection of static screens.

Focus on demonstrating the actual logic and workflow of self-healing routing.

--------------------------------------------------

20. PROJECT PURPOSE

--------------------------------------------------

The main purpose of the application is to demonstrate:

"How an intelligent network can detect or predict failures, search for alternative routes, verify network constraints, avoid common failure points, and automatically recover communication with minimum disruption."

Build the application so that it can be demonstrated easily during a college project presentation.

Prioritize:

1. Correct network visualization

2. Clear algorithm behavior

3. Failure simulation

4. Candidate route generation

5. CSP validation

6. Route selection

7. Automatic self-healing

8. Performance comparison

9. Professional UI

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d69973bc-d2fb-4373-85fb-f2faf9453ab2).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
