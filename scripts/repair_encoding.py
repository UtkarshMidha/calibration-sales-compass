"""Repair single-round misdecodings (cp1252/ANSI or OEM/CP437 flavour).

A corrupted run can only contain non-ASCII characters, so every maximal
non-ASCII run is a repair candidate. A repair is applied only when the
roundtrip strict-decodes to UTF-8; legitimate text can never satisfy this:
single chars (ae, middle dot, euro, ...) always fail strict decoding, and
the result must additionally be free of corruption markers. Everything
else is kept byte-identical and reported. This file is pure ASCII.

Usage:
  python scripts/repair_encoding.py --check [paths...]   report only
  python scripts/repair_encoding.py [paths...]           repair in place
  (no paths: git-modified .ts/.tsx/.js/.json/.css/.md files)
"""
import re
import sys

MARK1252 = {0xC3, 0xC2, 0xE2}
BOX = set(list(range(0x2500, 0x2580)) + list(range(0x2580, 0x25A0)))
RUN = re.compile("[^\\x00-\\x7F]+")
CHECK = re.compile(
    "["
    + "".join("\\u%04x" % c for c in sorted(MARK1252 | BOX | {0xFFFD}))
    + "]"
)


def esc(s):
    return s.encode("unicode_escape").decode("ascii")


def repair_run(run):
    cps = set(ord(c) for c in run)
    order = ("cp1252", "cp437") if (cps & MARK1252) else ("cp437", "cp1252")
    for enc in order:
        try:
            back = run.encode(enc).decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError):
            continue
        if CHECK.search(back):
            continue
        return back, enc
    return None, None


def process(path, check, log):
    text = open(path, encoding="utf-8").read()
    out = []
    last = 0
    n_fix = 0
    for m in RUN.finditer(text):
        out.append(text[last:m.start()])
        fixed, enc = repair_run(m.group(0))
        if fixed is None:
            out.append(m.group(0))
            if CHECK.search(m.group(0)):
                log.append("KEEP %s :: %s" % (path, esc(m.group(0)[:60])))
        else:
            n_fix += 1
            out.append(fixed)
            log.append(
                "FIX %s via %s :: %s -> %s"
                % (path, enc, esc(m.group(0)[:60]), esc(fixed[:60]))
            )
        last = m.end()
    out.append(text[last:])
    result = "".join(out)
    if result != text and not check:
        open(path, "w", encoding="utf-8", newline="").write(result)
    return n_fix


def main():
    check = "--check" in sys.argv
    paths = [a for a in sys.argv[1:] if a != "--check"]
    if not paths:
        import os
        import subprocess
        out = subprocess.check_output(
            ["git", "status", "--short"], text=True
        ).splitlines()
        paths = []
        for l in out:
            s = l.strip()
            if s.startswith("M ") or s.startswith(" M"):
                p = s[2:].strip().strip('"')
                if os.path.isfile(p) and p.endswith(
                    (".ts", ".tsx", ".js", ".json", ".css", ".md")
                ):
                    paths.append(p)
    log = []
    total = 0
    for p in sorted(set(paths)):
        total += process(p, check, log)
    with open("repair-log.txt", "w", encoding="ascii") as fh:
        fh.write("\n".join(log) if log else "(no findings)")
    print("repaired runs: %d (check=%s), details in repair-log.txt" % (total, check))
    if check and log:
        sys.exit(1)


if __name__ == "__main__":
    main()
