// Content for the MRI Physics Bench app: units, labs (guide notes, missions, quick checks, suggested questions)
// and the glossary. Missions test the instrument's live readout text (r = readout + " | " + its longer
// description) and count only while the student is operating that instrument.
(function () {
  const num = (s, re) => { const m = s.match(re); return m ? parseFloat(m[1].replace("−", "-")) : NaN; };
  const between = (v, lo, hi) => v >= lo && v <= hi;
  const lines = (s) => { const m = s.match(/(\d+)\/(\d+) lines/); return m ? +m[1] >= +m[2] && +m[2] > 0 : false; };

  window.BENCH_UNITS = [
    { id: "physics", label: "Physics", title: "MRI physics", sub: "From a hydrogen nucleus to an image, and what goes wrong in it" },
    { id: "fmri", label: "fMRI", title: "fMRI", sub: "From blood flow to a statistical map" },
    { id: "diffusion", label: "Diffusion", title: "Diffusion", sub: "Water's random walk as a probe of tissue and wiring" },
  ];

  window.BENCH_LABS = [
    {
      n: 1, unit: "physics", file: "proton-board", name: "Proton compass board", tags: "B0 · net magnetization",
      title: "Protons line up, barely",
      notice: [
        "In a field, protons settle parallel or anti-parallel. They do not all swing round like compass needles.",
        "The excess along the field is tiny: about 10 per million at 3 T. The board magnifies it 12,600 times.",
        "That excess is the net magnetization, and it grows with B0. So does signal-to-noise: watch the noise on the film fade.",
      ],
      try: [
        "Move across the figure to sweep B0 from 0 to 7 T.",
        "<kbd>1</kbd>–<kbd>4</kbd> jump to 0, 1.5, 3 and 7 T.",
        "Compare the film at 1.5 T and 7 T.",
      ],
      missions: [
        { id: "15t", text: "Set a 1.5 T clinical field.", test: (r) => between(num(r, /B0 ([\d.]+) T/), 1.45, 1.55) },
        { id: "3t", text: "Set 3 T and read the excess: about 10 protons per million.", test: (r) => between(num(r, /B0 ([\d.]+) T/), 2.95, 3.05) },
        { id: "7t", text: "Turn the field up to a 7 T research magnet.", test: (r) => num(r, /B0 ([\d.]+) T/) >= 6.95 },
      ],
      quiz: [
        { q: "Doubling B0 from 1.5 T to 3 T changes the proton excess by about…", options: ["×1.4", "×2", "×4", "Nothing; it is fixed"], answer: 1, why: "At body temperature the excess is proportional to B0 (the tanh in the Boltzmann formula is still on its straight part), so doubling the field doubles the net magnetization and the signal." },
        { q: "At 3 T, how many protons per million line up with the field beyond an even split?", options: ["About 10", "About 10,000", "About half of them", "All of them"], answer: 0, why: "About 9.9 per million at 310 K. MRI works with a very small surplus, which is why signal-to-noise is precious." },
      ],
      asks: ["Why is the proton excess so small at body temperature?", "Why does a stronger magnet give a better image?", "If protons are not compass needles, what is the net magnetization?"],
    },
    {
      n: 2, unit: "physics", file: "larmor-top", name: "Larmor top and RF tuner", tags: "precession · resonance",
      title: "Precession and resonance",
      notice: [
        "Tipped magnetization precesses at f0 = 42.58 MHz per tesla × B0.",
        "An RF pulse only tips it when the RF frequency matches f0. Off resonance, nothing happens.",
        "Only tipped (transverse) magnetization gives signal, so the film and the spectrum stay blank until the pulse lands.",
        "Zoomed in to a few parts per million, hydrogen in different molecules resonates slightly apart: NAA, creatine and choline. That is MR spectroscopy.",
      ],
      try: [
        "Move across the figure to tune the dial, click to transmit.",
        "<kbd>T</kbd> tunes to f0, <kbd>Enter</kbd> transmits.",
        "<kbd>1</kbd>–<kbd>3</kbd> set B0 to 1.5, 3 or 7 T, then find the new frequency.",
        "Move up and down (or <kbd>↑</kbd> <kbd>↓</kbd>) to sweep the analyzer's cursor. Compare choline and creatine at 1.5 T and 7 T.",
      ],
      missions: [
        { id: "res3", text: "Tune to resonance at 3 T and transmit: the top tips over.", test: (r) => /B0 3 T/.test(r) && /on resonance/.test(r) && num(r, /tip (\d+)°/) >= 60 },
        { id: "res15", text: "Find hydrogen's frequency at 1.5 T (about 64 MHz) and tip it.", test: (r) => /B0 1\.5 T/.test(r) && /on resonance/.test(r) && num(r, /tip (\d+)°/) >= 60 },
        { id: "res7", text: "Tip the magnetization at 7 T (about 298 MHz).", test: (r) => /B0 7 T/.test(r) && /on resonance/.test(r) && num(r, /tip (\d+)°/) >= 60 },
      ],
      quiz: [
        { q: "At 3 T, hydrogen precesses at about…", options: ["42.6 MHz", "64 MHz", "128 MHz", "298 MHz"], answer: 2, why: "f0 = 42.58 MHz/T × 3 T ≈ 127.7 MHz. 64 MHz is 1.5 T and 298 MHz is 7 T." },
        { q: "What does an RF pulse 3 MHz away from f0 do?", options: ["Tips the magnetization further", "Barely tips it at all", "Tips it the other way", "Speeds up the precession"], answer: 1, why: "The pulse only builds up a tip when it stays in step with the precession. Off resonance it drifts out of step and its effect averages away." },
      ],
      asks: ["Why does the RF frequency have to match the Larmor frequency?", "What is a chemical shift in parts per million?", "Why are spectra easier to read at 7 T?"],
    },
    {
      n: 3, unit: "physics", file: "relaxation-dome", name: "Relaxation dome", tags: "T1 · T2 · inversion",
      title: "Relaxation: T1 and T2",
      notice: [
        "The sideways part decays with T2 (37% left at t = T2). The upright part regrows with T1 (63% back at t = T1).",
        "T2 is always shorter, so the tip spirals in long before it is back to full height.",
        "After 180°, Mz passes through zero at T1·ln 2. Time a readout there and that tissue goes dark: inversion recovery, and with CSF, FLAIR.",
      ],
      try: [
        "<kbd>1</kbd>–<kbd>3</kbd> choose WM, GM or CSF; <kbd>F</kbd> switches 90° and 180°.",
        "Move across the figure to scrub through time.",
        "Pick CSF at 180° and stop at the null: watch CSF vanish from the Mz film.",
      ],
      missions: [
        { id: "t2wm", text: "Stop white matter at t ≈ T2, with 37% of Mxy left.", test: (r) => /^WM/.test(r) && /t ≈ T2/.test(r) },
        { id: "t1gm", text: "Stop grey matter at t ≈ T1, with Mz 63% recovered.", test: (r) => /^GM/.test(r) && /90°/.test(r) && /t ≈ T1/.test(r) },
        { id: "nullcsf", text: "Invert CSF and find its null point.", test: (r) => /^CSF/.test(r) && /180°/.test(r) && /null/.test(r) },
      ],
      quiz: [
        { q: "At t = T2 after a 90° pulse, the transverse magnetization is…", options: ["0%", "37% of its start", "50% of its start", "63% of its start"], answer: 1, why: "Mxy decays as e^(−t/T2), and e^(−1) ≈ 0.37. The 63% figure belongs to T1 recovery: 1 − e^(−1)." },
        { q: "After a 180° inversion, Mz crosses zero at…", options: ["T1", "T1·ln 2 ≈ 0.69·T1", "T2", "TR/2"], answer: 1, why: "Mz = M0(1 − 2e^(−t/T1)) is zero when e^(−t/T1) = 1/2, so t = T1·ln 2. For CSF (T1 4000 ms) that is about 2.8 s at a long TR." },
      ],
      asks: ["Why is T2 always shorter than T1?", "Why does CSF have such a long T1?", "How does inversion recovery make a tissue disappear?"],
    },
    {
      n: 4, unit: "physics", file: "contrast-desk", name: "Contrast desk", tags: "SE · FLAIR · gradient echo",
      title: "Choosing contrast",
      notice: [
        "Spin echo: short TR lets only short-T1 tissue recover, so white matter is bright and CSF dark (T1w). Long TR with long TE keeps only long-T2 tissue, so CSF is bright (T2w). Long TR with short TE leaves proton density.",
        "Inversion recovery: each tissue vanishes at its own null time TI. FLAIR nulls CSF and keeps T2 contrast; a TI near 0.9 s gives MPRAGE's strong T1 contrast.",
        "Gradient echo: the flip angle takes over from TR. Each tissue gives most signal at its Ernst angle, and the echo decays with T2* instead of T2.",
      ],
      try: [
        "<kbd>1</kbd>–<kbd>3</kbd> spin echo T1w, PDw, T2w · <kbd>4</kbd> FLAIR · <kbd>5</kbd> MPRAGE-like · <kbd>6</kbd>–<kbd>7</kbd> gradient echo T1w, T2*w.",
        "Move across for TR, TI or flip angle (depending on the sequence), up and down for TE. <kbd>M</kbd> changes the sequence, <kbd>[</kbd> <kbd>]</kbd> change TR.",
        "In FLAIR, slide TI past the lit dots and watch white matter, grey matter and CSF go dark in turn.",
      ],
      missions: [
        { id: "t2w", text: "Set up a T2-weighted spin echo.", test: (r) => /^SE/.test(r) && /· T2w ·/.test(r) },
        { id: "flair", text: "Null CSF with inversion recovery: a FLAIR.", test: (r) => /FLAIR/.test(r) },
        { id: "t2s", text: "Make a gradient echo T2*-weighted.", test: (r) => /^GRE/.test(r) && /T2\*w/.test(r) },
      ],
      quiz: [
        { q: "A long TR with a long TE gives…", options: ["T1 weighting: white matter brightest", "T2 weighting: CSF brightest", "Proton density weighting", "No contrast at all"], answer: 1, why: "A long TR lets every tissue recover, removing T1 differences; a long TE then leaves the most signal in the tissue with the longest T2, which is CSF." },
        { q: "FLAIR chooses its inversion time to…", options: ["Null fat", "Null white matter", "Null CSF", "Maximise CSF"], answer: 2, why: "Fluid-attenuated inversion recovery reads out when CSF's Mz crosses zero, so lesions next to the ventricles stand out on a T2-weighted background." },
      ],
      asks: ["Why is CSF dark on a T1-weighted image?", "What TR and TE would give proton-density weighting?", "Why does FLAIR use such a long TR?"],
    },
    {
      n: 5, unit: "physics", file: "spin-echo-track", name: "Spin-echo track", tags: "T2* · echoes · SE vs GRE",
      title: "The spin echo",
      notice: [
        "Field inhomogeneity fans the spins out: the signal dies in milliseconds (T2*).",
        "Each 180° pulse brings them back together one TE later: an echo, and a train of them.",
        "Spin-echo heights follow T2, not T2*. A worse shim narrows each echo but never lowers it.",
        "Gradient echoes have no 180° pulse: their heights follow T2*, so the shim decides whether they survive. That sensitivity is what BOLD fMRI uses.",
        "Later echoes give darker, more T2-weighted films. Fitting them is how a T2 map is made.",
      ],
      try: [
        "Move across for TE, up and down for the shim.",
        "<kbd>1</kbd>–<kbd>4</kbd> set the number of echoes; <kbd>G</kbd> switches spin echo and gradient echo.",
        "Set TE to 30 ms and three echoes, then compare the films in both modes with a good shim and a poor one.",
        "Read the recorder like the sequence diagrams in your textbook: RF, Gz, Gy, Gx, echo.",
      ],
      missions: [
        { id: "se1", text: "Catch the first spin echo as it forms.", test: (r) => /^SE/.test(r) && /echo 1/.test(r) },
        { id: "gre1", text: "Switch to gradient echo and catch its first echo.", test: (r) => /^GRE/.test(r) && /echo 1/.test(r) },
        { id: "train", text: "Run a train of four echoes.", test: (r) => /· 4 echoes ·/.test(r) },
      ],
      quiz: [
        { q: "The heights of successive spin echoes fall with…", options: ["T1", "T2", "T2*", "TR"], answer: 1, why: "The 180° pulses undo the static field differences that cause T2* decay, so only true T2 relaxation lowers each echo." },
        { q: "Why does BOLD fMRI use gradient echoes?", options: ["They are T2*-sensitive, like the field changes deoxyhaemoglobin makes", "They need no gradients", "They have the most signal", "They remove T2 effects"], answer: 0, why: "Without a 180° pulse nothing refocuses the small field disturbances around veins, so the signal tracks T2*, which changes with blood oxygenation." },
      ],
      asks: ["What does the 180° pulse actually do to the spins?", "What is the difference between T2 and T2*?", "Why does a poor shim not lower a spin echo?"],
    },
    {
      n: 6, unit: "physics", file: "asl-marble-run", name: "ASL marble run", tags: "label · delay · subtract",
      title: "Blood flow without a contrast agent",
      notice: [
        "An RF coil at the neck inverts blood water as it flows past. After a post-labelling delay (PLD) it has reached the brain, and an image is taken. A control image without labelling is subtracted.",
        "The difference is under 1% of the signal: control and label look identical, one pair is mostly noise, and only averaging many pairs reveals the grey-matter ribbon.",
        "The PLD must be longer than the blood's transit time (the lit dots), or CBF is underestimated, white matter most of all. Too long a PLD and the label has decayed with blood T1.",
      ],
      try: [
        "Watch which marbles light up: only those passing the coil while it labels.",
        "<kbd>1</kbd>–<kbd>4</kbd> average 1, 4, 16 or 64 pairs; compare the last two films.",
        "Move across to set the PLD. At 600 ms the image still looks fine, but the readout's CBF drops from 60/20 to about 32/6.",
      ],
      missions: [
        { id: "avg64", text: "Average 64 label–control pairs.", test: (r) => /64 pairs/.test(r) },
        { id: "short", text: "Shorten the PLD below 1000 ms and watch white-matter CBF collapse.", test: (r) => num(r, /PLD (\d+)/) < 1000 },
        { id: "right", text: "Read the textbook 60/20 with at least 16 pairs.", test: (r) => /CBF 60\/20/.test(r) && num(r, /(\d+) pairs?/) >= 16 },
      ],
      quiz: [
        { q: "ASL measures blood flow by…", options: ["Injecting gadolinium", "Labelling inflowing blood magnetically and subtracting a control image", "Measuring T2* changes", "Timing the echo"], answer: 1, why: "Blood water is inverted as it passes the labelling plane; after a delay the labelled image is subtracted from a control, leaving a signal proportional to the blood delivered." },
        { q: "A PLD shorter than the arterial transit time makes CBF…", options: ["Overestimated", "Underestimated", "Unchanged", "Negative"], answer: 1, why: "The label has not yet arrived in the tissue when the image is read, so the scanner sees less delivered blood than there will be." },
      ],
      asks: ["Why is the ASL difference signal so small?", "How do I choose a post-labelling delay?", "Why is white-matter CBF hard to measure with ASL?"],
    },
    {
      n: 7, unit: "physics", file: "kspace-plotter", name: "k-space plotter", tags: "k-space · FOV · EPI",
      title: "From k-space to an image",
      notice: [
        "The scanner records spatial frequencies, not pixels. The readout gradient sweeps along kx, and each phase-encoding step moves to a new line in ky. The image is the inverse Fourier transform of what has been recorded.",
        "Every point of k-space affects every pixel. The image only takes shape once the plotter crosses the bright centre: the centre holds contrast, the edges hold detail.",
        "Line spacing sets the field of view. Skip every other line and the field of view halves, so the head wraps onto itself.",
        "Line by line needs one excitation per line (minutes); EPI covers every line after one excitation (about a tenth of a second), which is what fMRI and diffusion use.",
      ],
      try: [
        "Move across the figure to scrub through the lines and find where the image appears.",
        "<kbd>1</kbd>–<kbd>4</kbd> full, centre only, edges only, every other line.",
        "<kbd>E</kbd> switches line by line and EPI; watch the RF lamp and the scan time in the readout.",
      ],
      missions: [
        { id: "centre", text: "Acquire only the centre of k-space: a complete but blurry head.", test: (r) => /centre/.test(r) && lines(r) },
        { id: "wrap", text: "Skip every other line and watch the head wrap.", test: (r) => /½ lines/.test(r) && lines(r) },
        { id: "epi", text: "Scan the full image with EPI and compare the scan time.", test: (r) => /^EPI/.test(r) && /full/.test(r) && lines(r) },
      ],
      quiz: [
        { q: "The centre of k-space holds…", options: ["Fine detail and edges", "Overall contrast and brightness", "Only noise", "The phase of the RF"], answer: 1, why: "Low spatial frequencies sit at the centre and set the broad shapes and contrast; the outer lines add edges and detail." },
        { q: "Acquiring every other phase-encoding line…", options: ["Doubles the resolution", "Halves the field of view, so the head wraps", "Removes noise", "Changes the contrast"], answer: 1, why: "Line spacing in k-space sets the field of view (FOV = 1/Δk). Doubling the spacing halves the FOV, and anything outside it folds back in." },
      ],
      asks: ["What is k-space, intuitively?", "Why does skipping lines make the head wrap?", "How does EPI cover k-space after one excitation?"],
    },
    {
      n: 8, unit: "physics", file: "artifact-clinic", name: "Artifact clinic", tags: "spike · motion · wrap · EPI",
      title: "Reading artifacts",
      notice: [
        "Each artifact is a fault in k-space, and its shape in the image tells you which one. A single bad sample stripes the whole image; motion between lines makes ghosts along phase encoding; missing outer k-space makes edges ring; too few lines make the head wrap.",
        "EPI has artifacts of its own: misaligned left- and right-going lines make a ghost at half the field of view, and a small field offset near the sinuses stretches the frontal lobe, because EPI is so slow along phase encoding.",
        "EPI also freezes motion: switch motion on together with an EPI fault and the motion ghosts disappear.",
      ],
      try: [
        "<kbd>1</kbd>–<kbd>6</kbd> switch faults on and off (they combine), <kbd>0</kbd> clears them.",
        "Watch the bench: the spark gap fires, the subject's sled jiggles, the end stops close in, the magnet slides up.",
        "Cover the readout and name the fault from the image alone.",
      ],
      missions: [
        { id: "spike", text: "Fire a spike and find the herringbone stripes.", test: (r) => /spike/.test(r) },
        { id: "ghost", text: "Make an EPI ghost at half the field of view.", test: (r) => /EPI ghost/.test(r) },
        { id: "frozen", text: "Find the fault that EPI freezes.", test: (r) => /frozen/.test(r) },
      ],
      quiz: [
        { q: "A single corrupt k-space sample produces…", options: ["A bright dot", "Stripes across the whole image", "A ghost at half the FOV", "Wrap-around"], answer: 1, why: "One point in k-space is one spatial frequency: a single wave pattern spread over every pixel, seen as herringbone stripes." },
        { q: "Why does EPI not show motion ghosts?", options: ["It acquires every line within about 0.1 s of one excitation", "It uses a 180° pulse", "It has more signal", "It filters motion out"], answer: 0, why: "Ghosts come from the head being in different places for different lines. EPI is so fast that the head hardly moves during one image." },
      ],
      asks: ["How do I tell a motion ghost from an EPI Nyquist ghost?", "Why does EPI distort near the sinuses?", "What causes Gibbs ringing?"],
    },
    {
      n: 9, unit: "fmri", file: "bold-balloon", name: "BOLD balloon", tags: "flow · deoxyhaemoglobin · BOLD",
      title: "Where the BOLD signal comes from",
      notice: [
        "The scanner does not see neurons fire. Their activity makes the arterioles upstream dilate (the handwheel), and blood flow rises far more than the extra oxygen the tissue uses.",
        "The surplus washes deoxyhaemoglobin (the beads) out of the veins. Deoxyhaemoglobin is paramagnetic and shortens T2* (Fig 5), so with less of it the EPI image gets about 1% brighter.",
        "The response is slow: a 1 s flash peaks seconds later, and the signal dips below baseline afterwards because blood volume recovers more slowly than flow.",
        "On the raw EPI film the change is invisible; only the change image (×20) shows visual cortex.",
      ],
      try: [
        "<kbd>1</kbd>–<kbd>3</kbd> one flash, two flashes, a 20 s block; <kbd>Enter</kbd> runs it again.",
        "Move across the figure to scrub through time.",
        "With two flashes, compare the solid trace with the dashed single responses: they nearly add up.",
        "Watch the balloon after the block ends: flow is back to normal before volume is, so beads build up and the trace dips.",
      ],
      missions: [
        { id: "peak", text: "Catch a single flash at its peak, about +1%.", test: (r) => /^event/.test(r) && num(r, /BOLD ([+-]?[\d.]+)%/) >= 0.9 },
        { id: "undershoot", text: "Find the undershoot after a 20 s block.", test: (r) => /^block/.test(r) && num(r, /BOLD ([+-]?[\d.]+)%/) <= -0.3 },
        { id: "sum", text: "Run two flashes and see them add up past +1.2%.", test: (r) => /^two events/.test(r) && num(r, /BOLD ([+-]?[\d.]+)%/) >= 1.2 },
      ],
      quiz: [
        { q: "During activity the BOLD signal rises because…", options: ["Neurons emit radio waves", "Blood flow rises more than oxygen use, washing out deoxyhaemoglobin", "Oxygen is paramagnetic", "Blood volume falls"], answer: 1, why: "Oversupply of oxygenated blood lowers the deoxyhaemoglobin concentration in venous blood, which lengthens T2* and brightens a gradient-echo image." },
        { q: "After a long stimulus ends, the signal…", options: ["Stops at once", "Dips below baseline for a while", "Stays raised for minutes", "Oscillates"], answer: 1, why: "Flow drops back quickly but the venous volume relaxes slowly, so deoxyhaemoglobin briefly accumulates: the post-stimulus undershoot." },
      ],
      asks: ["Why is the BOLD response delayed by several seconds?", "Is BOLD a direct measure of neural firing?", "What causes the post-stimulus undershoot?"],
    },
    {
      n: 10, unit: "fmri", file: "hrf-press", name: "HRF printing press", tags: "convolution · design efficiency",
      title: "Predicting the signal",
      notice: [
        "Because responses add (Fig 9), the signal predicted for any design is the design convolved with one response shape, the HRF: every second of stimulus prints one copy, and the copies sum.",
        "The sum, sampled once per scan, becomes a column of the design matrix in the lightbox. That column is what the analysis fits.",
        "A design is only as good as the variation it creates. Blocks win; events every 2 s fuse into a flat line; the same 2 s slots filled at random give twice the efficiency with half the events.",
      ],
      try: [
        "<kbd>1</kbd>–<kbd>4</kbd> blocked, slow, fast fixed, jittered. Watch the stamp press and the needle settle.",
        "Compare <kbd>3</kbd> and <kbd>4</kbd>: the same time slots, but only one of them leaves the analysis something to detect.",
        "Move across the figure to scrub; the design matrix fills in one scan at a time.",
      ],
      missions: [
        { id: "jitter", text: "Scrub a jittered design to the end of the run.", test: (r) => /^jittered/.test(r) && num(r, /t (\d+) s/) >= 155 },
        { id: "flat", text: "Find the design that fuses into a flat plateau.", test: (r) => /^fast fixed/.test(r) && num(r, /t (\d+) s/) >= 100 },
        { id: "best", text: "Print the most efficient design past its second block.", test: (r) => /^blocked/.test(r) && num(r, /t (\d+) s/) >= 64 },
      ],
      quiz: [
        { q: "For detecting activation, the most efficient design here is…", options: ["Blocked", "Slow events", "Fast fixed events", "Jittered events"], answer: 0, why: "Blocks produce large, sustained swings in the predicted signal, and detection efficiency grows with how much the prediction varies." },
        { q: "Events every 2 s at fixed timing give little to detect because…", options: ["The HRF is too short", "The responses merge into a flat plateau", "They saturate the scanner", "There are too few events"], answer: 1, why: "Overlapping responses sum to a nearly constant level, and a constant is removed with the baseline and drift." },
      ],
      asks: ["What does convolution mean in plain words?", "Why does jitter make a design more efficient?", "When would I choose an event-related design over blocks?"],
    },
    {
      n: 11, unit: "fmri", file: "glm-desk", name: "GLM desk", tags: "GLM · t · false positives",
      title: "Fitting and testing every voxel",
      notice: [
        "Each voxel's time course is modelled as β1·task + β2·drift + β0 + noise. Least squares picks the βs that leave the smallest residuals, and t is β1 divided by its standard error.",
        "A voxel of pure noise can still reach t = 2.4: significant at p &lt; 0.05, and wrong.",
        "Test 2,094 voxels at p &lt; 0.05 and about 5% of the empty ones pass: here 96. Stricter thresholds remove them but miss weak activation: FWE leaves no false positives and finds only 28 of 88 visual-cortex voxels.",
      ],
      try: [
        "<kbd>F</kbd> fits by least squares. Move up and down over the figure to set the task fader by hand and watch the residual lights.",
        "<kbd>1</kbd>–<kbd>2</kbd> choose the V1 voxel or the frontal voxel, a false positive.",
        "<kbd>T</kbd> steps through the thresholds; count the speckles outside the dotted outline.",
      ],
      missions: [
        { id: "fitv1", text: "Fit the V1 voxel by least squares.", test: (r) => /^V1 voxel/.test(r) && /t 7\.60/.test(r) },
        { id: "fitfp", text: "Fit the frontal voxel and read its t: a false positive.", test: (r) => /^frontal voxel/.test(r) && /t 2\.43/.test(r) },
        { id: "fwe", text: "Find the threshold that leaves no false positives.", test: (r) => /FWE/.test(r) && /false \+ 0/.test(r) },
      ],
      quiz: [
        { q: "A voxel's t value is…", options: ["Its raw signal change", "The effect estimate divided by its standard error", "The number of scans", "The residual noise"], answer: 1, why: "t = β̂ / SE(β̂): how large the fitted effect is compared with how much it would wobble from noise alone." },
        { q: "Testing 2,000 voxels with no real effect at p < 0.05, uncorrected, gives about…", options: ["0 false positives", "5", "100", "1,000"], answer: 2, why: "Each test has a 5% chance of passing by luck, so about 0.05 × 2,000 = 100 voxels pass. Corrections such as FDR and FWE exist for this." },
      ],
      asks: ["What does least squares minimise?", "What is the difference between FDR and FWE?", "Why include a drift regressor in the model?"],
    },
    {
      n: 12, unit: "diffusion", file: "diffusion-tray", name: "Diffusion tray", tags: "b-value · ADC · stroke",
      title: "Diffusion weighting and the ADC",
      notice: [
        "Two gradient lobes either side of the 180° pulse wind each molecule's phase according to where it is, then unwind it. Molecules that stayed put come back into phase; those that moved keep a leftover phase.",
        "So the echo falls as S0·e<sup>−b·ADC</sup>. At b = 1000 s/mm² free water (CSF) keeps 5% of its signal; grey matter, where cells get in the way, keeps 45%.",
        "An acute infarct hinders the water further: bright on DWI and dark on ADC, while the b = 0 image, which is T2-weighted, still looks normal. That is why DWI finds a stroke within minutes.",
        "A week later the infarct can still glow on DWI because its T2 has risen (T2 shine-through); its normal ADC gives it away. Months later it is fluid: dark on DWI, bright on ADC.",
      ],
      try: [
        "Move across the figure to set b from 0 to 3000 s/mm² (or <kbd>←</kbd> <kbd>→</kbd>). At b = 0 the DWI film is just the T2 image; at 3000, CSF sinks into the noise.",
        "<kbd>1</kbd>–<kbd>3</kbd> acute, subacute, chronic. Compare all three films each time.",
        "Watch the dials through one sequence: the signal vanishes while the phases are wound into a helix and returns at the echo, minus what diffusion took.",
      ],
      missions: [
        { id: "b3000", text: "Raise b to 3000 s/mm² and watch CSF vanish.", test: (r) => num(r, /b (\d+) s\/mm²/) >= 2950 },
        { id: "shine", text: "Find T2 shine-through.", test: (r) => /^subacute/.test(r) && num(r, /b (\d+) s\/mm²/) >= 900 },
        { id: "chronic", text: "Find the stage where the infarct turns dark on DWI.", test: (r) => /^chronic/.test(r) && num(r, /b (\d+) s\/mm²/) >= 900 },
      ],
      quiz: [
        { q: "An acute infarct looks…", options: ["Bright on DWI, dark on ADC", "Dark on DWI, bright on ADC", "Bright on both", "Invisible on DWI"], answer: 0, why: "Cytotoxic oedema restricts water, lowering the ADC (dark on the map) and preserving signal at high b (bright on DWI)." },
        { q: "T2 shine-through is recognised by…", options: ["Bright DWI with a low ADC", "Bright DWI with a normal or high ADC", "Dark DWI", "A bright b = 0 only"], answer: 1, why: "The DWI is bright because T2 is long, not because diffusion is restricted, so the ADC map does not show the drop." },
      ],
      asks: ["Why is DWI so good at finding acute strokes?", "What does the b-value control?", "Why is the ADC called apparent?"],
    },
    {
      n: 13, unit: "diffusion", file: "tensor-bench", name: "Tensor bench", tags: "anisotropy · FA · tracts",
      title: "The diffusion tensor and tractography",
      notice: [
        "In white matter, water moves easily along the axons and is held back across them, so the ADC depends on the gradient's direction: 1.7 along the bundle, 0.3 across it (×10⁻³ mm²/s).",
        "Measuring at least six directions fits a tensor, the ellipse. Its average is the mean diffusivity (MD), its elongation the fractional anisotropy (FA, 0 to 1), and its long axis, V1, the fibre direction.",
        "Colour FA paints V1: red left–right (corpus callosum), green front–back (optic radiations), blue up–down (internal capsule). Tractography strings V1 together into streamlines.",
        "Crossing fibres fool the tensor: the ADC peaks between the bundles, the fitted ellipse becomes a disc, FA drops to 0.45, and V1 points along neither bundle.",
      ],
      try: [
        "<kbd>1</kbd>–<kbd>4</kbd> a fibre bundle, crossing fibres, grey matter, water. Watch the ADC trace build up as the gradient sweeps round.",
        "Move across the figure to turn the gradient by hand and read the ADC in each direction.",
        "<kbd>T</kbd> reruns the tractography. Notice where the streamlines stop: where FA falls, or where the fibres leave the slice.",
      ],
      missions: [
        { id: "across", text: "Measure the bundle straight across its fibres.", test: (r) => /^bundle/.test(r) && between(num(r, /gradient (\d+)°/), 85, 95) },
        { id: "crossing", text: "Fit crossing fibres and watch FA fall to 0.45.", test: (r) => /^crossing/.test(r) && /FA 0\.45/.test(r) },
        { id: "water", text: "Measure free water's anisotropy.", test: (r) => /^CSF/.test(r) && /FA 0\.00/.test(r) },
      ],
      quiz: [
        { q: "Fractional anisotropy measures…", options: ["How fast water diffuses on average", "How direction-dependent diffusion is, from 0 to 1", "The fibre direction", "The number of fibres"], answer: 1, why: "FA compares the tensor's eigenvalues: 0 when diffusion is the same in every direction, near 1 when it happens along one axis only. The mean speed is MD." },
        { q: "Where two fibre bundles cross, the tensor…", options: ["Points along the stronger bundle", "Becomes a flat disc with lower FA, pointing along neither bundle", "Shows two directions", "Has the highest FA in the brain"], answer: 1, why: "One tensor can only describe one ellipsoid; averaging two crossing bundles gives a planar shape, and its first eigenvector lands between them." },
      ],
      asks: ["What do the colours on a colour FA map mean?", "Why can't a single tensor describe crossing fibres?", "How does tractography decide where to go next?"],
    },
  ];

  window.BENCH_GLOSSARY = [
    ["ADC", "Apparent diffusion coefficient: how fast water spreads in a tissue as measured with diffusion weighting, ln(S0/Sb)/b. Low in acute stroke.", 12],
    ["Anisotropy", "Diffusion that depends on direction, as in white matter, where water moves more easily along the axons.", 13],
    ["ASL", "Arterial spin labelling: inverting blood water at the neck and subtracting a control image to measure blood flow without a contrast agent.", 6],
    ["B0", "The main static magnetic field of the scanner, in tesla (1.5, 3 or 7 T).", 1],
    ["b-value", "How strongly an image is diffusion weighted, in s/mm². It grows with the gradient's strength and the time between the two lobes.", 12],
    ["BOLD", "Blood-oxygen-level-dependent signal: the small rise in T2*-weighted signal when active tissue receives more oxygenated blood than it uses.", 9],
    ["CBF", "Cerebral blood flow, in ml of blood per 100 g of tissue per minute; about 60 in grey matter and 20 in white matter.", 6],
    ["Convolution", "Sliding one shape along another and adding up the overlaps; here, printing one haemodynamic response for every moment of stimulus.", 10],
    ["Design matrix", "The table of regressors, one column each, sampled at every scan, that the GLM fits to each voxel's time course.", 10],
    ["DWI", "Diffusion-weighted image: an image taken with diffusion gradients on, darkest where water moves most.", 12],
    ["EPI", "Echo-planar imaging: covering all of k-space after one excitation in about a tenth of a second. The workhorse of fMRI and diffusion.", 7],
    ["FA", "Fractional anisotropy: how elongated the diffusion tensor is, from 0 (the same in every direction) to 1.", 13],
    ["FDR", "False discovery rate: a threshold that keeps the expected share of false positives among the voxels found below a chosen level, such as 5%.", 11],
    ["Field of view", "The width of the imaged region. It is set by the spacing of lines in k-space; too small and the anatomy wraps around.", 7],
    ["Flip angle", "How far an RF pulse tips the magnetization away from B0.", 2],
    ["FLAIR", "Fluid-attenuated inversion recovery: a T2-weighted image with CSF nulled by inversion recovery.", 4],
    ["FWE", "Family-wise error: a threshold that makes even one false positive across the whole map unlikely. Bonferroni is the simplest version.", 11],
    ["GLM", "General linear model: each voxel's time course modelled as a weighted sum of regressors plus noise, fitted by least squares.", 11],
    ["Gradient echo", "An echo formed by reversing a gradient instead of applying a 180° pulse; its signal decays with T2*.", 5],
    ["HRF", "Haemodynamic response function: the BOLD response to a brief stimulus, peaking about 5 s later with an undershoot after it.", 10],
    ["k-space", "The grid of spatial frequencies the scanner records; the image is its inverse Fourier transform.", 7],
    ["Larmor frequency", "The precession frequency of a nucleus in a field: 42.58 MHz per tesla for hydrogen.", 2],
    ["MD", "Mean diffusivity: the average of the diffusion tensor's three eigenvalues.", 13],
    ["MNI space", "A standard brain coordinate system in millimetres, with the origin near the anterior commissure.", 0],
    ["Net magnetization", "The vector sum of all proton magnetic moments in a voxel; the small surplus aligned with B0.", 1],
    ["Phase encoding", "Stepping through lines of k-space by giving each line a different phase twist across the image.", 7],
    ["PLD", "Post-labelling delay: the wait between labelling the blood and taking the ASL image.", 6],
    ["Proton density", "The relative number of mobile hydrogen nuclei in a tissue; CSF is highest.", 4],
    ["Radiological view", "Images shown as if looking up from the patient's feet, so the patient's right is on the viewer's left.", 0],
    ["RF pulse", "A short burst of radio waves at the Larmor frequency that tips the magnetization.", 2],
    ["Spin echo", "An echo made by a 180° pulse that refocuses spins dephased by field differences; its height decays with T2.", 5],
    ["t value", "An effect estimate divided by its standard error; large values are unlikely under noise alone.", 11],
    ["T1", "The time constant for the magnetization to regrow along B0 (63% back after T1). Longest in CSF.", 3],
    ["T2", "The time constant for the transverse magnetization to decay from spin–spin interactions (37% left after T2).", 3],
    ["T2*", "The faster decay of transverse magnetization that adds field inhomogeneity to T2. Gradient echoes and BOLD depend on it.", 5],
    ["TE", "Echo time: from excitation to the centre of the echo. Long TE emphasises T2 differences.", 4],
    ["TI", "Inversion time: from the 180° inversion pulse to the excitation in inversion recovery.", 4],
    ["TR", "Repetition time: from one excitation to the next. Short TR emphasises T1 differences.", 4],
    ["Tractography", "Joining principal diffusion directions from voxel to voxel into streamlines that trace white-matter pathways.", 13],
    ["V1", "The first eigenvector of the diffusion tensor: the direction of fastest diffusion, taken as the fibre direction.", 13],
    ["Voxel", "A three-dimensional pixel: the smallest volume element of an image.", 0],
  ];
})();
