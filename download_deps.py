#!/usr/bin/env python3

# PEP 723 metadata
# /// script
# requires-python = ">=3.10"
# dependencies = [
#   "huggingface-hub"
# ]
# ///

import argparse
import os
import shutil
import tarfile
import tempfile
import time
import urllib.request
import zipfile
from typing import Union


def _tar_gz_looks_valid(path: str) -> bool:
    """Reject truncated uv (or other) tarballs so we re-download instead of skipping."""
    try:
        if not os.path.isfile(path) or os.path.getsize(path) < 2048:
            return False
        with tarfile.open(path, "r:gz") as tf:
            return next(iter(tf), None) is not None
    except (tarfile.ReadError, EOFError, OSError):
        return False


def _truthy_env(name: str) -> bool:
    return os.environ.get(name, "").strip().lower() in ("1", "true", "yes", "on")


from huggingface_hub import snapshot_download


UV_RELEASE = "0.9.16"


def _uv_linux_tar_urls(arch: str, *, use_china_mirrors: bool) -> list[str]:
    """GitHub release assets; try mirrors first when building in CN."""
    name = f"uv-{arch}-unknown-linux-gnu.tar.gz"
    gh = f"https://github.com/astral-sh/uv/releases/download/{UV_RELEASE}/{name}"
    if not use_china_mirrors:
        return [gh]
    return [
        f"https://mirror.ghproxy.com/https://github.com/astral-sh/uv/releases/download/{UV_RELEASE}/{name}",
        f"https://ghproxy.net/{gh}",
        f"https://gitclone.com/github.com/astral-sh/uv/releases/download/{UV_RELEASE}/{name}",
        gh,
    ]


def get_urls(use_china_mirrors: bool, *, include_chrome: bool) -> list[Union[str, list]]:
    chrome_entries: list[Union[str, list[str]]] = []
    if include_chrome:
        if use_china_mirrors:
            chrome_entries = [
                [
                    "https://registry.npmmirror.com/-/binary/chrome-for-testing/121.0.6167.85/linux64/chrome-linux64.zip",
                    "chrome-linux64-121-0-6167-85",
                ],
                [
                    "https://registry.npmmirror.com/-/binary/chrome-for-testing/121.0.6167.85/linux64/chromedriver-linux64.zip",
                    "chromedriver-linux64-121-0-6167-85",
                ],
            ]
        else:
            chrome_entries = [
                [
                    "https://storage.googleapis.com/chrome-for-testing-public/121.0.6167.85/linux64/chrome-linux64.zip",
                    "chrome-linux64-121-0-6167-85",
                ],
                [
                    "https://storage.googleapis.com/chrome-for-testing-public/121.0.6167.85/linux64/chromedriver-linux64.zip",
                    "chromedriver-linux64-121-0-6167-85",
                ],
            ]

    if use_china_mirrors:
        base: list[Union[str, list[str]]] = [
            "http://mirrors.tuna.tsinghua.edu.cn/ubuntu/pool/main/o/openssl/libssl1.1_1.1.1f-1ubuntu2_amd64.deb",
            "http://mirrors.tuna.tsinghua.edu.cn/ubuntu-ports/pool/main/o/openssl/libssl1.1_1.1.1f-1ubuntu2_arm64.deb",
            "https://repo.huaweicloud.com/repository/maven/org/apache/tika/tika-server-standard/3.3.0/tika-server-standard-3.3.0.jar",
            "https://repo.huaweicloud.com/repository/maven/org/apache/tika/tika-server-standard/3.3.0/tika-server-standard-3.3.0.jar.md5",
            "https://openaipublic.blob.core.windows.net/encodings/cl100k_base.tiktoken",
            [_uv_linux_tar_urls("x86_64", use_china_mirrors=True), "uv-x86_64-unknown-linux-gnu.tar.gz"],
            [_uv_linux_tar_urls("aarch64", use_china_mirrors=True), "uv-aarch64-unknown-linux-gnu.tar.gz"],
        ]
    else:
        base = [
            "http://archive.ubuntu.com/ubuntu/pool/main/o/openssl/libssl1.1_1.1.1f-1ubuntu2_amd64.deb",
            "http://ports.ubuntu.com/pool/main/o/openssl/libssl1.1_1.1.1f-1ubuntu2_arm64.deb",
            "https://repo1.maven.org/maven2/org/apache/tika/tika-server-standard/3.3.0/tika-server-standard-3.3.0.jar",
            "https://repo1.maven.org/maven2/org/apache/tika/tika-server-standard/3.3.0/tika-server-standard-3.3.0.jar.md5",
            "https://openaipublic.blob.core.windows.net/encodings/cl100k_base.tiktoken",
            [_uv_linux_tar_urls("x86_64", use_china_mirrors=False), "uv-x86_64-unknown-linux-gnu.tar.gz"],
            [_uv_linux_tar_urls("aarch64", use_china_mirrors=False), "uv-aarch64-unknown-linux-gnu.tar.gz"],
        ]
    return base + chrome_entries


def _write_stub_chrome_artifacts() -> None:
    """Minimal valid zips so Dockerfile.deps COPY + main Dockerfile unzip succeed (Selenium may not work)."""
    stub = b"#!/bin/sh\nexit 0\n"
    chrome_name = "chrome-linux64-121-0-6167-85"
    driver_name = "chromedriver-linux64-121-0-6167-85"
    with zipfile.ZipFile(chrome_name, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zi = zipfile.ZipInfo("chrome-linux64/chrome")
        zi.external_attr = 0o755 << 16
        zf.writestr(zi, stub)
    with zipfile.ZipFile(driver_name, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zi = zipfile.ZipInfo("chromedriver-linux64/chromedriver")
        zi.external_attr = 0o755 << 16
        zf.writestr(zi, stub)
    print(f"Wrote stub archives (NO_CHROME_DOWNLOAD): {chrome_name}, {driver_name}")


# Full list when not skipping XGB line-merge model (see hf_repos_to_download).
_HF_REPOS_ALL = [
    "InfiniFlow/text_concat_xgb_v1.0",
    "InfiniFlow/deepdoc",
]


def _text_concat_xgb_download_disabled() -> bool:
    return _truthy_env("RAGFLOW_DISABLE_TEXT_CONCAT_XGB") or _truthy_env("SKIP_TEXT_CONCAT_XGB_DOWNLOAD")


def hf_repos_to_download(*, disable_text_concat_xgb: bool) -> list[str]:
    if disable_text_concat_xgb:
        return ["InfiniFlow/deepdoc"]
    return list(_HF_REPOS_ALL)


def _nltk_zip_root_urls(use_china: bool) -> list[str]:
    """Roots that host NLTK's published zips under .../packages/<subdir>/<id>.zip (GitHub raw or fronted mirrors)."""
    custom = os.environ.get("TBOX_NLTK_PACKAGES_ROOTS", "").strip()
    if custom:
        return [x.rstrip("/") + "/" for x in custom.split(",") if x.strip()]
    gh = "https://raw.githubusercontent.com/nltk/nltk_data/gh-pages/packages/"
    mirrors = [
        f"https://mirror.ghproxy.com/{gh}",
        f"https://ghproxy.net/{gh}",
    ]
    if use_china:
        return mirrors + [gh]
    return [gh] + mirrors


def _nltk_zip_specs() -> list[tuple[str, str, str, str]]:
    """(package_id, zip path under packages/, install subdir, top-level folder name inside zip)."""
    return [
        ("wordnet", "corpora/wordnet.zip", "corpora", "wordnet"),
        ("punkt", "tokenizers/punkt.zip", "tokenizers", "punkt"),
        ("punkt_tab", "tokenizers/punkt_tab.zip", "tokenizers", "punkt_tab"),
    ]


def _nltk_installed(local_dir: str, subdir: str, folder: str) -> bool:
    p = os.path.join(local_dir, subdir, folder)
    try:
        return os.path.isdir(p) and bool(os.listdir(p))
    except OSError:
        return False


def _http_download_file(url: str, dest_path: str, *, timeout_sec: int = 180) -> None:
    """HTTPS GET to a file; explicit timeout and UA reduce flaky servers resetting bare urllib clients."""
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "RAGFlow-download_deps/1.0 (+https://github.com/infiniflow/ragflow)"},
    )
    with urllib.request.urlopen(req, timeout=timeout_sec) as resp, open(dest_path, "wb") as out:
        shutil.copyfileobj(resp, out)


def _download_nltk_packages_direct(local_dir: str, *, use_china: bool) -> None:
    """Install NLTK corpora/tokenizers without nltk.download() TCP to GitHub only — mirrors + retries reduce errno 104."""
    roots = _nltk_zip_root_urls(use_china)
    for pkg_id, zip_rel, subdir, zip_root in _nltk_zip_specs():
        if _nltk_installed(local_dir, subdir, zip_root):
            print(f"Skipping nltk {pkg_id} (already under {local_dir}/{subdir}/{zip_root}).")
            continue
        print(f"Downloading nltk {pkg_id} (direct zip)...")
        dest_zip = os.path.join(local_dir, subdir, os.path.basename(zip_rel))
        os.makedirs(os.path.dirname(dest_zip), exist_ok=True)
        last_exc: Exception | None = None
        downloaded = False
        for root in roots:
            url = root.rstrip("/") + "/" + zip_rel.lstrip("/")
            for attempt in range(1, 5):
                try:
                    if os.path.isfile(dest_zip):
                        try:
                            os.unlink(dest_zip)
                        except OSError:
                            pass
                    _http_download_file(url, dest_zip)
                    with zipfile.ZipFile(dest_zip, "r") as zf:
                        names = zf.namelist()
                        if not names:
                            raise OSError("empty zip")
                        bad = [n for n in names if n.startswith("/") or ".." in n.replace("\\", "/").split("/")]
                        if bad:
                            raise OSError(f"refusing zip with suspicious paths: {bad[:3]}")
                        if not all(n.replace("\\", "/").startswith(f"{zip_root}/") or n.replace("\\", "/") == zip_root for n in names):
                            raise OSError(f"zip root folder expected {zip_root!r}, got sample: {names[:5]!r}")
                        with tempfile.TemporaryDirectory(prefix=f"nltk_{pkg_id}_") as td:
                            zf.extractall(td)
                            src = os.path.join(td, zip_root)
                            if not os.path.isdir(src):
                                raise OSError(f"expected directory {zip_root!r} after unzip")
                            target = os.path.join(local_dir, subdir, zip_root)
                            if os.path.isdir(target):
                                shutil.rmtree(target, ignore_errors=True)
                            shutil.move(src, target)
                    try:
                        os.unlink(dest_zip)
                    except OSError:
                        pass
                    downloaded = True
                    print(f"  nltk {pkg_id} OK via {url}")
                    break
                except Exception as exc:  # noqa: BLE001
                    last_exc = exc
                    print(f"  nltk {pkg_id} attempt {attempt}/4 ({root!r}): {exc}")
                    time.sleep(min(5 + attempt * 4, 45))
            if downloaded:
                break
        if not downloaded:
            assert last_exc is not None
            raise last_exc


def _ensure_text_concat_placeholder_dir() -> None:
    """Empty repo path so Dockerfile.deps `COPY huggingface.co` still has InfiniFlow/text_concat_xgb_v1.0/."""
    p = os.path.join("huggingface.co", "InfiniFlow", "text_concat_xgb_v1.0")
    os.makedirs(p, exist_ok=True)
    mark = os.path.join(p, ".ragflow_text_concat_xgb_disabled")
    if not os.path.isfile(mark):
        with open(mark, "w", encoding="utf-8") as fp:
            fp.write("RAGFLOW_DISABLE_TEXT_CONCAT_XGB: updown_concat_xgb.model not downloaded; runtime skips XGB-based PDF line merge.\n")


def _hf_endpoints_to_try(china: bool) -> list[str]:
    """Order of Hub API roots. Override with HF_ENDPOINT (single) or TBOX_HF_ENDPOINTS (comma-separated)."""
    raw = os.environ.get("TBOX_HF_ENDPOINTS", "").strip()
    if raw:
        return [x.strip().rstrip("/") for x in raw.split(",") if x.strip()]
    manual = os.environ.get("HF_ENDPOINT", "").strip()
    if manual:
        return [manual.rstrip("/")]
    if china:
        return ["https://hf-mirror.com", "https://huggingface.co"]
    return ["https://huggingface.co"]


def _find_first_file(root: str, basename: str) -> str | None:
    for dirpath, _dirnames, filenames in os.walk(root):
        if basename in filenames:
            p = os.path.join(dirpath, basename)
            if os.path.isfile(p):
                return p
    return None


def _count_incomplete_blobs(root: str) -> int:
    n = 0
    for dirpath, _dirnames, filenames in os.walk(root):
        for fn in filenames:
            if fn.endswith(".incomplete"):
                n += 1
    return n


def verify_hf_repo_layout(repository_id: str, local_directory: str) -> None:
    """Fail fast if Hub cache is partial (*.incomplete) or ONNX/model files are missing."""
    if repository_id == "InfiniFlow/deepdoc":
        det = _find_first_file(local_directory, "det.onnx")
        min_det = 50 * 1024
        if not det or os.path.getsize(det) < min_det:
            inc = _count_incomplete_blobs(local_directory)
            msg = f"Incomplete InfiniFlow/deepdoc under {local_directory!r}: need det.onnx (real file, min {min_det} bytes)."
            if inc:
                msg += f" Found {inc} '*.incomplete' blob(s) — a previous download was interrupted."
            msg += (
                " Fix: rm -rf huggingface.co/InfiniFlow/deepdoc && "
                "HF_ENDPOINT=https://hf-mirror.com uv run --with huggingface_hub hf download "
                "InfiniFlow/deepdoc --local-dir huggingface.co/InfiniFlow/deepdoc"
            )
            raise OSError(msg)
        rec = _find_first_file(local_directory, "rec.onnx")
        if not rec or os.path.getsize(rec) < min_det:
            raise OSError(f"Incomplete InfiniFlow/deepdoc: rec.onnx missing or too small under {local_directory!r}. Remove the directory and re-download as for det.onnx.")
    elif repository_id == "InfiniFlow/text_concat_xgb_v1.0":
        m = _find_first_file(local_directory, "updown_concat_xgb.model")
        if not m or os.path.getsize(m) < 32:
            raise OSError(f"Incomplete InfiniFlow/text_concat_xgb_v1.0 under {local_directory!r}: missing updown_concat_xgb.model. Remove the directory and re-download from the Hub.")


def _snapshot_download_repo(repository_id: str, local_directory: str) -> None:
    """Use single-file worker by default — fewer parallel TCP streams, fewer mid-download RST (errno 104)."""
    if not os.environ.get("HF_HUB_ENABLE_HF_TRANSFER", "").strip():
        os.environ["HF_HUB_ENABLE_HF_TRANSFER"] = "0"
    try:
        snapshot_download(repo_id=repository_id, local_dir=local_directory, max_workers=1)
    except TypeError:
        snapshot_download(repo_id=repository_id, local_dir=local_directory)


def download_model(repository_id: str, *, china: bool) -> None:
    local_directory = os.path.abspath(os.path.join("huggingface.co", repository_id))
    os.makedirs(local_directory, exist_ok=True)
    last_exc: Exception | None = None
    max_attempts_per_endpoint = 6
    for ep in _hf_endpoints_to_try(china):
        os.environ["HF_ENDPOINT"] = ep
        for attempt in range(1, max_attempts_per_endpoint + 1):
            try:
                _snapshot_download_repo(repository_id, local_directory)
                verify_hf_repo_layout(repository_id, local_directory)
                print(f"  snapshot_download OK for {repository_id} via HF_ENDPOINT={ep}")
                return
            except Exception as exc:  # noqa: BLE001
                last_exc = exc
                print(f"  huggingface {repository_id} attempt {attempt}/{max_attempts_per_endpoint} via {ep}: {exc}")
                time.sleep(min(10 + attempt * 8, 90))
    assert last_exc is not None
    raise last_exc


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Download dependencies with optional China mirror support")
    parser.add_argument("--china-mirrors", action="store_true", help="Use China-accessible mirrors for downloads")
    parser.add_argument(
        "--skip-chrome",
        action="store_true",
        help="Skip large Chrome/Chromedriver downloads; write tiny stub zips for Docker build (Selenium broken).",
    )
    parser.add_argument(
        "--skip-nltk",
        action="store_true",
        help="Skip NLTK corpora download (creates empty nltk_data/ if missing). May break parsers using NLTK.",
    )
    parser.add_argument(
        "--skip-huggingface",
        action="store_true",
        help="Skip Hugging Face model snapshots (image build may still need models elsewhere).",
    )
    parser.add_argument(
        "--disable-text-concat-xgb",
        action="store_true",
        help="Skip InfiniFlow/text_concat_xgb_v1.0 download; use with RAGFLOW_DISABLE_TEXT_CONCAT_XGB=1 at runtime.",
    )
    args = parser.parse_args()
    use_china = bool(args.china_mirrors) or _truthy_env("TBOX_CHINA_DOWNLOAD")
    skip_chrome = bool(args.skip_chrome) or _truthy_env("NO_CHROME_DOWNLOAD") or _truthy_env("SKIP_CHROME_DEPS")
    skip_nltk = bool(args.skip_nltk) or _truthy_env("SKIP_NLTK_DOWNLOAD")
    skip_hf = bool(args.skip_huggingface) or _truthy_env("SKIP_HUGGINGFACE_DOWNLOAD")
    disable_text_concat = bool(args.disable_text_concat_xgb) or _text_concat_xgb_download_disabled()
    if disable_text_concat:
        _ensure_text_concat_placeholder_dir()
        print("Skipping InfiniFlow/text_concat_xgb_v1.0 Hub download (--disable-text-concat-xgb or RAGFLOW_DISABLE_TEXT_CONCAT_XGB / SKIP_TEXT_CONCAT_XGB_DOWNLOAD).")
    hf_repos = hf_repos_to_download(disable_text_concat_xgb=disable_text_concat)

    hf_eps = _hf_endpoints_to_try(use_china)
    print(f"Hugging Face endpoints to try (set HF_ENDPOINT or TBOX_HF_ENDPOINTS to override): {hf_eps}")

    urls = get_urls(use_china, include_chrome=not skip_chrome)

    for item in urls:
        if isinstance(item, list) and len(item) == 2 and isinstance(item[0], list):
            download_urls, filename = item[0], item[1]
        elif isinstance(item, list) and len(item) == 2:
            download_urls, filename = [item[0]], item[1]
        else:
            assert isinstance(item, str)
            download_urls = [item]
            filename = item.split("/")[-1]

        def _need_download() -> bool:
            if not os.path.exists(filename):
                return True
            if filename.endswith(".tar.gz") and not _tar_gz_looks_valid(filename):
                print(f"Removing incomplete or corrupt gzip tarball: {filename}")
                os.unlink(filename)
                return True
            return False

        if not _need_download():
            print(f"Skipping {filename} (already present).")
            continue

        last_exc: Exception | None = None
        downloaded = False
        for download_url in download_urls:
            print(f"Downloading {filename} from {download_url}...")
            for attempt in range(1, 4):
                try:
                    urllib.request.urlretrieve(download_url, filename)
                    if filename.endswith(".tar.gz") and not _tar_gz_looks_valid(filename):
                        raise OSError(f"archive failed integrity check after download: {filename}")
                    downloaded = True
                    break
                except Exception as exc:  # noqa: BLE001
                    last_exc = exc
                    if os.path.isfile(filename):
                        try:
                            os.unlink(filename)
                        except OSError:
                            pass
                    if attempt == 3:
                        print(f"  mirror exhausted after: {exc}")
                        break
                    print(f"  retry {attempt}/3 after: {exc}")
                    time.sleep(5)
            if downloaded:
                break
        if not downloaded:
            assert last_exc is not None
            raise last_exc

    if skip_chrome:
        _write_stub_chrome_artifacts()

    local_dir = os.path.abspath("nltk_data")
    if skip_nltk:
        os.makedirs(local_dir, exist_ok=True)
        print("Skipping NLTK downloads (--skip-nltk / SKIP_NLTK_DOWNLOAD).")
    else:
        os.makedirs(local_dir, exist_ok=True)
        _download_nltk_packages_direct(local_dir, use_china=use_china)

    if skip_hf:
        for repo_id in hf_repos:
            d = os.path.abspath(os.path.join("huggingface.co", repo_id))
            if not os.path.isdir(d) or not os.listdir(d):
                raise SystemExit(f"Refusing --skip-huggingface: missing local huggingface.co/{repo_id}. Download once without this flag or copy models in.")
            verify_hf_repo_layout(repo_id, d)
        print("Skipping Hugging Face snapshot_download (--skip-huggingface).")
    else:
        for repo_id in hf_repos:
            print(f"Downloading huggingface repo {repo_id}...")
            download_model(repo_id, china=use_china)
