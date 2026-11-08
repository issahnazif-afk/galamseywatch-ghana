#!/usr/bin/env python3
"""End-to-end browser test. Needs: pip install playwright, and Chrome. Saves screenshots to test-shots/."""
import functools, http.server, os, sys, threading
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[1]; OUT = ROOT / "test-shots"; OUT.mkdir(exist_ok=True)
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 8765), functools.partial(H, directory=str(ROOT))); threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = "http://127.0.0.1:8765/"; ARGS = ["--no-sandbox", "--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"]
fails, errs = [], []
def check(n, c, d=""):
    print(("PASS " if c else "FAIL ") + n + (f" [{d}]" if d else ""));
    if not c: fails.append(n)
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path=next(p for p in ("/usr/bin/google-chrome", "/usr/bin/chromium") if os.path.exists(p)), args=ARGS)
    def page(vp=(1440, 860)):
        p = b.new_page(viewport={"width": vp[0], "height": vp[1]}); p.on("pageerror", lambda e: errs.append(str(e)))
        p.on("console", lambda m: m.type == "error" and not any(s in m.text for s in ("ERR_", "Failed to load", "Failed to fetch", "AJAXError")) and errs.append(m.text)); return p
    rendered = lambda p: p.evaluate("__gw.map.queryRenderedFeatures({layers:['pixels']}).length")
    p = page(); p.goto(BASE); check("landing has two tools", p.locator(".tool").count() == 2); p.locator(".tool.g").click(); p.wait_for_url("**/galamsey/**")
    p.wait_for_selector(".zone-list button"); p.wait_for_timeout(2500)
    check("galamsey: 4 passes", p.locator(".date-tab").count() == 4); check("galamsey: pills", p.locator(".zone-pill").count() == 30)
    check("galamsey: alerts badge", p.locator(".badge").inner_text() != "")
    p.locator(".zone-list button").first.click(); p.wait_for_timeout(2200)
    check("zone dots drawn", rendered(p) > 5, rendered(p)); check("zone card", p.locator(".stats .stat").count() == 3)
    # layer switch, table layer and back
    p.get_by_label("Map layers").click(); p.get_by_role("menuitemradio", name="River muddiness").click(); p.wait_for_timeout(900); check("layer change legend", "Sediment" in p.locator(".legend-title").inner_text())
    p.get_by_label("Map layers").click(); p.get_by_role("menuitemradio", name="Water intakes").click(); p.wait_for_timeout(900); check("intake table", p.locator(".closures tbody tr").count() == 8)
    p.get_by_label("Map layers").click(); p.get_by_role("menuitemradio", name="Mining disturbance").click(); p.wait_for_timeout(900)
    # date change changes the hash
    p.locator(".date-tab").first.click(); p.wait_for_timeout(600); check("date in url", "date=" in p.url)
    # area select
    p.get_by_role("button", name="Select area").click(); box = p.locator("#map").bounding_box()
    p.mouse.move(600, 300); p.mouse.down(); p.mouse.move(900, 620, steps=6); p.mouse.up(); p.wait_for_timeout(500); check("trend card", p.locator(".trend .panel-body svg").count() == 1)
    p.get_by_label("Close").last.click(); p.get_by_label("Back to all districts").click(); p.wait_for_timeout(1200)
    # agency: public files must not include candidate markers
    check("public has no candidates", p.evaluate("__gw.map.querySourceFeatures('cands').length") == 0)
    p.locator(".mode-btn").click(); p.wait_for_timeout(1800); check("agency mode", "mode=agency" in p.url)
    pt = p.evaluate("(()=>{const f=__gw.map.queryRenderedFeatures({layers:['cands']})[0];const q=__gw.map.project(f.geometry.coordinates);const r=__gw.map.getContainer().getBoundingClientRect();return [q.x+r.left,q.y+r.top]})()")
    p.mouse.click(*pt); p.wait_for_timeout(600)
    if p.locator(".overlay .facts").count() == 0:   # a pill may sit over the marker: use state instead
        p.evaluate("document.querySelectorAll('.zone-pill').forEach(e=>e.style.display='none')"); p.mouse.click(*pt); p.wait_for_timeout(600)
    check("case opens", p.locator(".overlay .facts").count() == 1); p.get_by_role("button", name="Confirm").click(); check("case status", p.locator(".facts b").inner_text() == "Confirmed"); p.screenshot(path=OUT / "agency-case.png")
    p.get_by_label("Close").last.click(); p.get_by_role("button", name="Report safely").click(); check("report form", p.locator("#rep-w").count() == 1); p.get_by_label("Close").last.click()
    p.close()
    p = page(); p.goto(BASE + "flood/index.html"); p.wait_for_selector(".zone-list button"); p.wait_for_timeout(2500)
    check("flood: 5 days", p.locator(".date-tab").count() == 5); p.screenshot(path=OUT / "flood-national.png")
    p.locator(".search").fill("North Tongu"); p.locator(".zone-list button").first.click(); p.wait_for_timeout(2200)
    check("flood drivers", p.locator(".drivers tr").count() >= 4); check("flood dots", rendered(p) > 5); p.screenshot(path=OUT / "flood-district.png")
    check("no empty driver values", "null" not in p.locator(".drivers").inner_text())
    p.get_by_role("button", name="Get alerts").click(); check("sms preview", "North Tongu" in p.locator(".sms").inner_text()); p.close()
    p = page(); p.goto(BASE + "flood/index.html"); p.wait_for_selector(".zone-list button"); p.wait_for_timeout(1500); p.locator(".search").fill("Ablekuma North"); p.locator(".zone-list button").first.click(); p.wait_for_timeout(1200)
    check("small district has data", "null" not in p.locator(".zone-card").inner_text() and p.locator(".level-banner b").inner_text() != "\u2013"); p.close()
    p = page((390, 800)); p.goto(BASE + "flood/index.html"); p.wait_for_selector(".zone-list button"); p.wait_for_timeout(2500)
    check("Ghana fits above the phone card", p.evaluate("__gw.map.getZoom()") < 5.4, p.evaluate("__gw.map.getZoom()"))
    check("no sideways scroll", p.evaluate("document.documentElement.scrollWidth<=innerWidth")); p.screenshot(path=OUT / "flood-phone.png"); p.close()
    b.close()
check("no console errors", not errs, "; ".join(errs[:3]))
print(f"{len(fails)} failed"); sys.exit(1 if fails else 0)
