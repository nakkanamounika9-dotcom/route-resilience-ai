<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

Survivability features (connectivity metrics, augmentation advice, disjoint path protection) live in `src/lib/network/survivability.ts`, derived from Kuipers (2012), "An Overview of Algorithms for Network Survivability", and must stay pure TypeScript with no new dependencies. Why: the research-paper basis is a core product feature and the module must remain portable and testable.
