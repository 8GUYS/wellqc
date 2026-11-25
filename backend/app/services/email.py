"""
WellQC Transactional Email Service.

Handles user notification dispatch for account verification, password resets,
and audit alerts. Supports:
1. EmailJS REST API (https://api.emailjs.com/api/v1.0/email/send) - default & recommended
2. Resend REST API (https://api.resend.com/emails)
3. Informative Local Development Logger (prints highlighted verification URL in console)

Settings can be managed dynamically via the Admin Control Center or loaded from environment variables.
"""

import html
import json
import logging
import os
import urllib.request
import urllib.error
from typing import Dict, Any, Optional
from urllib.parse import urlparse
from backend.app.core.config import settings

logger = logging.getLogger("wellqc.email")


def get_effective_frontend_url(
    db: Optional[Any] = None,
    request: Optional[Any] = None,
    base_url_override: Optional[str] = None,
) -> str:
    """
    Resolve the canonical frontend base URL for verification and reset links.
    
    Priority:
    1. Explicit base_url_override if provided.
    2. Dynamic Request inspection: inspect standard reverse proxy headers
       (Origin, X-Forwarded-Host + X-Forwarded-Proto, Referer) so links dynamically match
       the exact caller origin (e.g. https://wellqc.vercel.app or branch preview).
    3. Database SystemSetting (e.g. email_settings["frontend_url"] or key "frontend_url").
    4. settings.FRONTEND_URL from environment / configuration.
    5. Fallback to https://wellqc.vercel.app if running in production / cloud.
    """
    if base_url_override and str(base_url_override).strip():
        return str(base_url_override).strip().rstrip("/")

    # 1. Dynamic Request header inspection
    if request is not None:
        try:
            # 1a. Check Origin header (e.g. "https://wellqc.vercel.app")
            origin = request.headers.get("origin")
            if origin and not origin.startswith("chrome-extension://"):
                origin_clean = origin.strip().rstrip("/")
                if any(x in origin_clean for x in ["vercel.app", "localhost", "127.0.0.1"]) or origin_clean in settings.CORS_ORIGINS:
                    return origin_clean

            # 1b. Check X-Forwarded-Host / X-Forwarded-Proto (standard from Vercel / Cloudflare reverse proxy)
            forwarded_host = request.headers.get("x-forwarded-host")
            if forwarded_host:
                primary_host = forwarded_host.split(",")[0].strip()
                proto = request.headers.get("x-forwarded-proto", "https").split(",")[0].strip()
                if any(x in primary_host for x in ["vercel.app", "localhost", "127.0.0.1"]) or primary_host in settings.CORS_ORIGINS:
                    return f"{proto}://{primary_host}".rstrip("/")

            # 1c. Check Referer header (e.g. "https://wellqc.vercel.app/register")
            referer = request.headers.get("referer")
            if referer:
                parsed = urlparse(referer)
                if parsed.scheme and parsed.netloc:
                    if any(x in parsed.netloc for x in ["vercel.app", "localhost", "127.0.0.1"]):
                        return f"{parsed.scheme}://{parsed.netloc}".rstrip("/")
        except Exception as e:
            logger.debug(f"Could not inspect frontend URL from request: {e}")

    # 2. Database SystemSetting
    try:
        from backend.app.core.database import SessionLocal
        from backend.app.models.models import SystemSetting
        local_db = db or SessionLocal()
        try:
            records = local_db.query(SystemSetting).filter(
                SystemSetting.key.in_(["frontend_url", "email_settings"])
            ).all()
            for r in records:
                if r.key == "frontend_url" and r.value and str(r.value).strip():
                    return str(r.value).strip().rstrip("/")
                if r.key == "email_settings" and r.value:
                    try:
                        cfg_dict = json.loads(r.value)
                        if isinstance(cfg_dict, dict) and cfg_dict.get("frontend_url"):
                            val = str(cfg_dict["frontend_url"]).strip().rstrip("/")
                            if val:
                                return val
                    except Exception:
                        pass
        finally:
            if not db:
                local_db.close()
    except Exception as e:
        logger.debug(f"Could not load frontend_url from database: {e}")

    # 3. Environment variable from settings
    configured = (settings.FRONTEND_URL or "").strip().rstrip("/")
    if configured and not any(loc in configured for loc in ["localhost", "127.0.0.1"]):
        return configured

    # 4. If environment indicates cloud / production (Render or neon.tech DB)
    if (
        bool(os.getenv("RENDER"))
        or os.getenv("NODE_ENV") == "production"
        or os.getenv("ENVIRONMENT") == "production"
        or "neon.tech" in getattr(settings, "DATABASE_URL", "")
        or "neon.tech" in getattr(settings, "POSTGRES_PRISMA_URL", "")
    ):
        return "https://wellqc.vercel.app"

    return configured or "http://localhost:3000"


def generate_verification_link(
    token: str,
    base_url: Optional[str] = None,
    db: Optional[Any] = None,
    request: Optional[Any] = None,
) -> str:
    """Build the full frontend verification URL with token parameter."""
    effective_base = get_effective_frontend_url(db=db, request=request, base_url_override=base_url)
    return f"{effective_base}/verify-email?token={token}"


def get_effective_email_config(db: Optional[Any] = None, request: Optional[Any] = None) -> Dict[str, Any]:
    """
    Retrieve current email dispatch configuration.
    Priority:
    1. Database SystemSetting (configured via Admin UI)
    2. Environment variables from settings (.env)
    """
    config = {
        "provider": settings.EMAIL_PROVIDER or "EMAILJS",
        "frontend_url": get_effective_frontend_url(db=db, request=request),
        "emailjs_service_id": settings.EMAILJS_SERVICE_ID or "",
        "emailjs_template_id": settings.EMAILJS_TEMPLATE_ID or "",
        "emailjs_reset_template_id": settings.EMAILJS_RESET_TEMPLATE_ID or "",
        "emailjs_public_key": settings.EMAILJS_PUBLIC_KEY or "",
        "emailjs_private_key": settings.EMAILJS_PRIVATE_KEY or "",
        "resend_api_key": settings.RESEND_API_KEY or "",
        "resend_from_email": settings.RESEND_FROM_EMAIL or "WellQC <onboarding@resend.dev>",
        "lead_notification_email": settings.LEAD_NOTIFICATION_EMAIL or "",
    }

    try:
        from backend.app.core.database import SessionLocal
        from backend.app.models.models import SystemSetting
        local_db = db or SessionLocal()
        try:
            record = local_db.query(SystemSetting).filter(SystemSetting.key == "email_settings").first()
            if record and record.value:
                db_data = json.loads(record.value)
                if isinstance(db_data, dict):
                    # Provider secrets (private keys/tokens) must NOT be read from the database;
                    # they strictly originate from environment variables to prevent secret leakage across DB branches.
                    # Note: emailjs_public_key is a non-secret user identifier and can be persisted in the DB.
                    excluded_db_keys = {
                        "emailjs_private_key",
                        "resend_api_key",
                    }
                    for k, v in db_data.items():
                        if k not in excluded_db_keys and v is not None and str(v).strip():
                            config[k] = str(v).strip()
        finally:
            if not db:
                local_db.close()
    except Exception as e:
        logger.debug(f"Could not load email_settings from database: {e}")

    # Ensure provider secrets and keys always strictly originate from environment variables
    config["emailjs_private_key"] = settings.EMAILJS_PRIVATE_KEY or ""
    config["resend_api_key"] = settings.RESEND_API_KEY or ""
    if settings.EMAILJS_PUBLIC_KEY:
        config["emailjs_public_key"] = settings.EMAILJS_PUBLIC_KEY

    return config


def _send_via_emailjs(
    to_email: str,
    to_name: str,
    subject: str,
    action_url: str,
    title: str = "WellQC Notification",
    message_body: str = "",
    button_text: str = "Open WellQC",
    footer_note: str = "",
    html_content: Optional[str] = None,
    text_content: Optional[str] = None,
    expires_in_hours: int = 24,
    template_id_override: Optional[str] = None,
    config: Optional[Dict[str, Any]] = None,
) -> Optional[Dict[str, Any]]:
    """
    Dispatch an email using EmailJS REST API.
    Endpoint: https://api.emailjs.com/api/v1.0/email/send

    Provides rich template_params supporting:
    1. Universal EmailJS templates using {{{email_html}}} or {{{message}}}
    2. Dynamic text templates using {{email_title}}, {{email_message}}, {{button_text}}, {{action_url}}
    3. Dedicated template IDs via template_id_override (e.g. emailjs_reset_template_id)
    """
    cfg = config or get_effective_email_config()
    service_id = (cfg.get("emailjs_service_id") or "").strip()
    template_id = (template_id_override or cfg.get("emailjs_template_id") or "").strip()
    public_key = (cfg.get("emailjs_public_key") or "").strip()
    private_key = (cfg.get("emailjs_private_key") or "").strip()

    if not service_id or not template_id or not public_key:
        logger.info("EmailJS is selected but service_id, template_id, or public_key is not yet configured.")
        return None

    url = "https://api.emailjs.com/api/v1.0/email/send"
    payload: Dict[str, Any] = {
        "service_id": service_id,
        "template_id": template_id,
        "user_id": public_key,
        "template_params": {
            # Recipient & general metadata
            "to_email": to_email,
            "to_name": to_name or "Petrophysicist",
            "app_name": "WellQC",
            "subject": subject,

            # Semantic titles and body messages
            "title": title,
            "email_title": title,
            "message": html_content or message_body,
            "email_message": message_body,
            "body": message_body,
            "body_message": message_body,

            # Action button & links (supports all common alias names)
            "action_url": action_url,
            "verification_url": action_url,
            "reset_url": action_url,
            "link": action_url,
            "button_text": button_text,
            "action_name": button_text,

            # Timing & security footer notes
            "expires_in": f"{expires_in_hours} hours",
            "expires_in_hours": str(expires_in_hours),
            "footer_note": footer_note,

            # Complete pre-rendered HTML payload from backend code (use {{{email_html}}} in EmailJS)
            "email_html": html_content or "",
            "html_content": html_content or "",
        },
    }
    if private_key:
        payload["accessToken"] = private_key

    headers = {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    }

    try:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=12) as resp:
            resp_body = resp.read().decode("utf-8", errors="ignore")
            logger.info(f"EmailJS email dispatched successfully to {to_email}. Response: {resp_body}")
            return {
                "id": f"emailjs-{to_email}",
                "response": resp_body or "OK",
            }
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8", errors="ignore").strip()
        logger.error(f"EmailJS API HTTPError ({e.code}): {error_body}")
        if "non-browser" in error_body.lower():
            err_msg = (
                "API access from non-browser environments is disabled in your EmailJS account. "
                "Please go to EmailJS Dashboard > Account > Security (https://dashboard.emailjs.com/admin/account/security) "
                "and enable 'Allow EmailJS API for non-browser applications'."
            )
        else:
            err_msg = f"EmailJS API returned HTTP {e.code}: {error_body}"
        return {"error": err_msg, "status_code": e.code}
    except Exception as e:
        logger.error(f"Unexpected error dispatching via EmailJS: {e}")
        return {"error": f"Connection error: {e}"}


def _send_via_resend(
    to_email: str,
    subject: str,
    html_content: str,
    text_content: str,
    config: Optional[Dict[str, Any]] = None,
) -> Optional[Dict[str, Any]]:
    """
    Dispatch an email using Resend's REST API.
    """
    cfg = config or get_effective_email_config()
    api_key = (cfg.get("resend_api_key") or "").strip()
    from_email = (cfg.get("resend_from_email") or settings.RESEND_FROM_EMAIL or "WellQC <onboarding@resend.dev>").strip()

    if not api_key:
        return None

    url = "https://api.resend.com/emails"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "User-Agent": "WellQC/1.0",
    }
    payload = {
        "from": from_email,
        "to": [to_email],
        "subject": subject,
        "html": html_content,
        "text": text_content,
    }

    try:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = resp.read().decode("utf-8")
            result = json.loads(body)
            logger.info(f"Resend email dispatched successfully to {to_email}. ID: {result.get('id')}")
            return result
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8", errors="ignore")
        logger.error(f"Resend API error ({e.code}): {error_body}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error dispatching via Resend: {e}")
        return None


def send_verification_email(
    email: str,
    name: str,
    token: str,
    expires_in_hours: int = 24,
    db: Optional[Any] = None,
    request: Optional[Any] = None,
    base_url: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Dispatch an account verification email containing a secure verification token.

    Attempts dispatch using the configured provider (EmailJS, Resend).
    If no remote keys are configured or delivery fails, falls back cleanly to the local terminal logger banner.
    """
    verification_url = generate_verification_link(token, base_url=base_url, db=db, request=request)
    recipient_display = f"{name} <{email}>" if name else email
    subject = "Verify Your WellQC Account"

    # HTML Email Template for providers supporting direct HTML
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>{subject}</title>
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b1120; color: #f8fafc; margin: 0; padding: 24px; }}
        .card {{ max-width: 540px; margin: 0 auto; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 16px; padding: 36px 32px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }}
        .brand {{ color: #38bdf8; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 24px; }}
        .title {{ color: #ffffff; font-size: 20px; font-weight: 700; margin-bottom: 12px; }}
        .text {{ color: #cbd5e1; font-size: 14px; line-height: 1.6; margin-bottom: 24px; }}
        .btn {{ display: inline-block; background: linear-gradient(to right, #0284c7, #06b6d4); color: #ffffff !important; text-decoration: none; font-weight: 700; font-size: 14px; padding: 12px 28px; border-radius: 10px; box-shadow: 0 4px 14px rgba(6, 182, 212, 0.3); }}
        .footer {{ margin-top: 32px; padding-top: 20px; border-top: 1px solid #1e293b; font-size: 12px; color: #64748b; line-height: 1.5; }}
        .url {{ word-break: break-all; color: #38bdf8; font-size: 12px; }}
      </style>
    </head>
    <body>
      <div class="card">
        <div class="brand">WellQC</div>
        <div class="title">Verify your email address</div>
        <div class="text">
          Hi {name or "there"},<br><br>
          Thank you for registering with <strong>WellQC</strong>. To complete your account activation and access your subsurface quality assurance workspace, please click the button below:
        </div>
        <div>
          <a href="{verification_url}" class="btn" target="_blank">Verify Email Address</a>
        </div>
        <div class="footer">
          This verification link expires automatically in {expires_in_hours} hours.<br>
          If the button above does not work, copy and paste this link into your browser:<br>
          <a href="{verification_url}" class="url">{verification_url}</a><br><br>
          If you did not create a WellQC account, you can safely disregard this email.
        </div>
      </div>
    </body>
    </html>
    """

    text_content = (
        f"Hi {name or 'there'},\n\n"
        f"Thank you for registering with WellQC. Please verify your email address to access your workspace:\n\n"
        f"{verification_url}\n\n"
        f"This link expires in {expires_in_hours} hours.\n\n"
        f"If you did not request this, please disregard this email."
    )

    effective_cfg = get_effective_email_config(db)
    provider = (effective_cfg.get("provider") or "EMAILJS").upper()

    # 1. Attempt EmailJS if chosen or if keys configured
    if provider == "EMAILJS":
        emailjs_res = _send_via_emailjs(
            to_email=email,
            to_name=name,
            subject=subject,
            action_url=verification_url,
            title="Verify your email address",
            message_body=f"Thank you for registering with WellQC. To complete your account activation and access your subsurface quality assurance workspace, please click the button below:",
            button_text="Verify Email Address",
            footer_note=f"This verification link expires automatically in {expires_in_hours} hours. If you did not create a WellQC account, you can safely disregard this email.",
            html_content=html_content,
            text_content=text_content,
            expires_in_hours=expires_in_hours,
            config=effective_cfg,
        )
        if emailjs_res and "error" not in emailjs_res:
            return {
                "status": "delivered",
                "transport": "emailjs",
                "recipient": email,
                "emailjsResponse": emailjs_res.get("response"),
            }

    # 2. Attempt Resend delivery if selected
    elif provider == "RESEND":
        resend_result = _send_via_resend(
            to_email=email,
            subject=subject,
            html_content=html_content,
            text_content=text_content,
            config=effective_cfg,
        )
        if resend_result:
            return {
                "status": "delivered",
                "transport": "resend",
                "recipient": email,
                "resendId": resend_result.get("id"),
            }

    # 3. Fallback to local terminal logger banner
    logger.info(f"Verification email dispatched for {recipient_display}. Verification token omitted from application logs.")
    if settings.ENVIRONMENT != "production":
        banner = (
            "\n"
            "╔════════════════════════════════════════════════════════════════════════════════════════════════╗\n"
            "║                     WellQC TRANSACTIONAL EMAIL DISPATCH (DEV LOGGER)                         ║\n"
            "╠════════════════════════════════════════════════════════════════════════════════════════════════╣\n"
            f"║  Recipient : {recipient_display:<74} ║\n"
            f"║  Subject   : {subject:<74} ║\n"
            f"║  Expires In: {expires_in_hours} Hours                                                                    ║\n"
            "╟────────────────────────────────────────────────────────────────────────────────────────────────╢\n"
            f"║  Verification Link (Local Dev Only):                                                           ║\n"
            f"║  {verification_url:<86} ║\n"
            "╚════════════════════════════════════════════════════════════════════════════════════════════════╝\n"
        )
        print(banner, flush=True)

    return {
        "status": "delivered",
        "transport": "local_dev_logger",
        "recipient": email,
        "verificationUrl": verification_url,
        "token": token,
    }


def send_test_email(
    to_email: str,
    config: Dict[str, Any],
    db: Optional[Any] = None,
    request: Optional[Any] = None,
) -> Dict[str, Any]:
    """
    Send a test email using the provided configuration to verify credentials.
    """
    provider = (config.get("provider") or "EMAILJS").upper()
    test_subject = "WellQC Email Configuration Test"
    effective_base = get_effective_frontend_url(db=db, request=request, base_url_override=config.get("frontend_url"))
    test_url = f"{effective_base}/workspace"

    test_html = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>{test_subject}</title>
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b1120; color: #f8fafc; margin: 0; padding: 24px; }}
        .card {{ max-width: 540px; margin: 0 auto; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 16px; padding: 36px 32px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }}
        .brand {{ color: #38bdf8; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 24px; }}
        .title {{ color: #ffffff; font-size: 20px; font-weight: 700; margin-bottom: 12px; }}
        .text {{ color: #cbd5e1; font-size: 14px; line-height: 1.6; margin-bottom: 24px; }}
        .btn {{ display: inline-block; background: linear-gradient(to right, #0284c7, #06b6d4); color: #ffffff !important; text-decoration: none; font-weight: 700; font-size: 14px; padding: 12px 28px; border-radius: 10px; box-shadow: 0 4px 14px rgba(6, 182, 212, 0.3); }}
        .footer {{ margin-top: 32px; padding-top: 20px; border-top: 1px solid #1e293b; font-size: 12px; color: #64748b; line-height: 1.5; }}
        .url {{ word-break: break-all; color: #38bdf8; font-size: 12px; }}
      </style>
    </head>
    <body>
      <div class="card">
        <div class="brand">WellQC</div>
        <div class="title">Email Delivery Configured</div>
        <div class="text">
          Hi Administrator,<br><br>
          This test email confirms that your <strong>WellQC</strong> transactional email delivery pipeline is fully functional and credentials are valid.
        </div>
        <div>
          <a href="{test_url}" class="btn" target="_blank">Open WellQC Workspace</a>
        </div>
        <div class="footer">
          Dispatched from WellQC Admin Control Center.<br>
          NUPRC / DPR Petroleum Industry Standards Compliant.
        </div>
      </div>
    </body>
    </html>
    """
    test_text = f"WellQC Email Test: Your email configuration is verified and active! Workspace: {test_url}"

    if provider == "EMAILJS":
        res = _send_via_emailjs(
            to_email=to_email,
            to_name="Administrator",
            subject=test_subject,
            action_url=test_url,
            title="Email Delivery Configured",
            message_body="This test email confirms that your WellQC transactional email delivery pipeline is fully functional and credentials are valid.",
            button_text="Open WellQC Workspace",
            footer_note="Dispatched from WellQC Admin Control Center.",
            html_content=test_html,
            text_content=test_text,
            expires_in_hours=24,
            config=config,
        )
        if res and "error" not in res:
            return {"success": True, "message": f"Test email dispatched successfully via EmailJS to {to_email}."}
        err_detail = (res or {}).get("error") if res else "Please verify your Service ID, Template ID, and Public Key."
        raise ValueError(f"EmailJS dispatch failed. {err_detail}")

    elif provider == "RESEND":
        res = _send_via_resend(
            to_email=to_email,
            subject=test_subject,
            html_content=test_html,
            text_content=test_text,
            config=config,
        )
        if res:
            return {"success": True, "message": f"Test email dispatched successfully via Resend to {to_email} (ID: {res.get('id')})."}
        raise ValueError("Resend dispatch failed. Please check your API Key and sender domain.")

    else:
        # DEV_LOGGER test
        return {"success": True, "message": f"Development Logger active. Links are printed directly to the backend console."}


def send_password_reset_email(
    email: str,
    name: str,
    token: str,
    expires_in_hours: int = 1,
    db: Optional[Any] = None,
    request: Optional[Any] = None,
    base_url: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Dispatch a password reset email using the active email provider
    (EmailJS, Resend, or local terminal logger fallback).
    """
    effective_base = get_effective_frontend_url(db=db, request=request, base_url_override=base_url)
    reset_url = f"{effective_base}/reset-password?token={token}"
    recipient_display = f"{name} <{email}>" if name else email
    subject = "Reset Your WellQC Password"

    # HTML Email Template
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>{subject}</title>
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b1120; color: #f8fafc; margin: 0; padding: 24px; }}
        .card {{ max-width: 540px; margin: 0 auto; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 16px; padding: 36px 32px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }}
        .brand {{ color: #38bdf8; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 24px; }}
        .title {{ color: #ffffff; font-size: 20px; font-weight: 700; margin-bottom: 12px; }}
        .text {{ color: #cbd5e1; font-size: 14px; line-height: 1.6; margin-bottom: 24px; }}
        .btn {{ display: inline-block; background: linear-gradient(to right, #0284c7, #06b6d4); color: #ffffff !important; text-decoration: none; font-weight: 700; font-size: 14px; padding: 12px 28px; border-radius: 10px; box-shadow: 0 4px 14px rgba(6, 182, 212, 0.3); }}
        .footer {{ margin-top: 32px; padding-top: 20px; border-top: 1px solid #1e293b; font-size: 12px; color: #64748b; line-height: 1.5; }}
        .url {{ word-break: break-all; color: #38bdf8; font-size: 12px; }}
      </style>
    </head>
    <body>
      <div class="card">
        <div class="brand">WellQC</div>
        <div class="title">Reset your password</div>
        <div class="text">
          Hi {name or "there"},<br><br>
          We received a request to reset the password for your <strong>WellQC</strong> account. Click the button below to choose a new password:
        </div>
        <div>
          <a href="{reset_url}" class="btn" target="_blank">Reset Password</a>
        </div>
        <div class="footer">
          This password reset link expires automatically in {expires_in_hours} hour(s).<br>
          If the button above does not work, copy and paste this link into your browser:<br>
          <a href="{reset_url}" class="url">{reset_url}</a><br><br>
          If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.
        </div>
      </div>
    </body>
    </html>
    """

    text_content = (
        f"Hi {name or 'there'},\n\n"
        f"We received a request to reset your WellQC password. Click the link below to choose a new password:\n\n"
        f"{reset_url}\n\n"
        f"This link expires in {expires_in_hours} hour(s).\n\n"
        f"If you did not request this, please disregard this email. Your password will remain unchanged."
    )

    effective_cfg = get_effective_email_config(db)
    provider = (effective_cfg.get("provider") or "EMAILJS").upper()

    # 1. Attempt EmailJS if chosen or configured
    if provider == "EMAILJS":
        emailjs_res = _send_via_emailjs(
            to_email=email,
            to_name=name,
            subject=subject,
            action_url=reset_url,
            title="Reset your password",
            message_body="We received a request to reset the password for your WellQC account. Click the button below to choose a new password:",
            button_text="Reset Password",
            footer_note=f"This password reset link expires automatically in {expires_in_hours} hour(s). If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.",
            html_content=html_content,
            text_content=text_content,
            expires_in_hours=expires_in_hours,
            template_id_override=effective_cfg.get("emailjs_reset_template_id"),
            config=effective_cfg,
        )
        if emailjs_res and "error" not in emailjs_res:
            return {
                "status": "delivered",
                "transport": "emailjs",
                "recipient": email,
                "emailjsResponse": emailjs_res.get("response"),
                "resetUrl": reset_url,
            }

    # 2. Attempt Resend delivery if selected
    elif provider == "RESEND":
        resend_result = _send_via_resend(
            to_email=email,
            subject=subject,
            html_content=html_content,
            text_content=text_content,
            config=effective_cfg,
        )
        if resend_result:
            return {
                "status": "delivered",
                "transport": "resend",
                "recipient": email,
                "resendId": resend_result.get("id"),
                "resetUrl": reset_url,
            }

    # 3. Fallback to local terminal logger banner
    logger.info(f"Password reset email dispatched for {recipient_display}. Reset token omitted from application logs.")
    if settings.ENVIRONMENT != "production":
        banner = (
            "\n"
            "╔════════════════════════════════════════════════════════════════════════════════════════════════╗\n"
            "║                  WellQC PASSWORD RESET NOTIFICATION (DEV LOGGER)                             ║\n"
            "╠════════════════════════════════════════════════════════════════════════════════════════════════╣\n"
            f"║  Recipient : {recipient_display:<74} ║\n"
            f"║  Subject   : {subject:<74} ║\n"
            f"║  Expires In: {expires_in_hours} Hour(s)                                                                   ║\n"
            "╟────────────────────────────────────────────────────────────────────────────────────────────────╢\n"
            f"║  Reset Link (Local Dev Only):                                                                  ║\n"
            f"║  {reset_url:<86} ║\n"
            "╚════════════════════════════════════════════════════════════════════════════════════════════════╝\n"
        )
        print(banner, flush=True)

    return {
        "status": "delivered",
        "transport": "local_dev_logger",
        "recipient": email,
        "resetUrl": reset_url,
        "token": token,
    }


def resolve_lead_notification_email(
    db: Optional[Any] = None,
    config: Optional[Dict[str, Any]] = None,
) -> Optional[str]:
    """
    Resolve the destination inbox for incoming enterprise demo requests and contact inquiries.
    Priority:
    1. Admin-configured `lead_notification_email` in SystemSetting["email_settings"]
    2. `LEAD_NOTIFICATION_EMAIL` environment variable
    3. Primary ADMIN user email from the `User` table
    """
    cfg = config or get_effective_email_config(db=db)
    explicit = (cfg.get("lead_notification_email") or settings.LEAD_NOTIFICATION_EMAIL or "").strip()
    if explicit and "@" in explicit:
        return explicit

    try:
        from sqlalchemy import func
        from backend.app.core.database import SessionLocal
        from backend.app.models.models import User

        local_db = db or SessionLocal()
        try:
            admin_row = (
                local_db.query(User.email)
                .filter(func.upper(User.role) == "ADMIN")
                .order_by(User.createdAt.asc())
                .first()
            )
            if admin_row and admin_row[0]:
                return str(admin_row[0]).strip()
        finally:
            if not db:
                local_db.close()
    except Exception as exc:
        logger.debug(f"Could not resolve admin email from database: {exc}")

    return None


def _dispatch_generic_email(
    *,
    to_email: str,
    to_name: str,
    subject: str,
    title: str,
    message_body: str,
    button_text: str,
    action_url: str,
    footer_note: str,
    html_content: str,
    text_content: str,
    config: Dict[str, Any],
) -> Dict[str, Any]:
    """Dispatch a transactional notification via EmailJS, Resend, or local dev logger."""
    provider = (config.get("provider") or "EMAILJS").upper()

    if provider == "EMAILJS":
        res = _send_via_emailjs(
            to_email=to_email,
            to_name=to_name,
            subject=subject,
            action_url=action_url,
            title=title,
            message_body=message_body,
            button_text=button_text,
            footer_note=footer_note,
            html_content=html_content,
            text_content=text_content,
            expires_in_hours=24,
            config=config,
        )
        if res and "error" not in res:
            return {"status": "delivered", "transport": "emailjs", "recipient": to_email}

    elif provider == "RESEND":
        res = _send_via_resend(
            to_email=to_email,
            subject=subject,
            html_content=html_content,
            text_content=text_content,
            config=config,
        )
        if res:
            return {"status": "delivered", "transport": "resend", "recipient": to_email, "resendId": res.get("id")}

    logger.info(f"Transactional notification logged for {to_email}: {subject}")
    if settings.ENVIRONMENT != "production":
        print(
            f"\n[WellQC DEV EMAIL] To: {to_name} <{to_email}> | Subject: {subject}\n{text_content}\n",
            flush=True,
        )
    return {"status": "logged", "transport": "local_dev_logger", "recipient": to_email}


def send_demo_request_emails(
    *,
    full_name: str,
    work_email: str,
    company: str,
    job_title: str = "",
    fleet_size: str = "",
    primary_objective: str = "",
    timeframe: str = "",
    notes: str = "",
    admin_email: Optional[str] = None,
    config: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Send:
    1. Internal lead alert email to the WellQC admin / sales inbox (if resolved)
    2. Confirmation receipt email to the prospective requester
    """
    cfg = config or get_effective_email_config()
    base_url = (cfg.get("frontend_url") or get_effective_frontend_url()).rstrip("/")
    target_admin = admin_email or resolve_lead_notification_email(config=cfg)

    safe_name = html.escape(full_name)
    safe_email = html.escape(work_email)
    safe_company = html.escape(company)
    safe_role = html.escape(job_title or "Not specified")
    safe_fleet = html.escape(fleet_size or "Not specified")
    safe_obj = html.escape(primary_objective or "Not specified")
    safe_time = html.escape(timeframe or "Flexible")
    safe_notes = html.escape(notes or "None provided")

    results: Dict[str, Any] = {"adminNotification": None, "requesterConfirmation": None}

    if target_admin:
        admin_subject = f"[WellQC Demo Request] {company} — {full_name}"
        admin_url = f"{base_url}/activity"
        admin_html = f"""
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><title>{html.escape(admin_subject)}</title></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0b1120; color: #f8fafc; margin: 0; padding: 24px;">
          <div style="max-width: 560px; margin: 0 auto; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 16px; padding: 32px;">
            <div style="color: #38bdf8; font-size: 20px; font-weight: 800; margin-bottom: 16px;">WellQC Enterprise Lead</div>
            <div style="color: #ffffff; font-size: 18px; font-weight: 700; margin-bottom: 16px;">New Technical Demonstration Request</div>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #cbd5e1; margin-bottom: 20px;">
              <tr><td style="padding: 6px 0; color: #94a3b8;">Contact:</td><td style="padding: 6px 0; font-weight: 600; color: #ffffff;">{safe_name}</td></tr>
              <tr><td style="padding: 6px 0; color: #94a3b8;">Work Email:</td><td style="padding: 6px 0;"><a href="mailto:{safe_email}" style="color: #38bdf8;">{safe_email}</a></td></tr>
              <tr><td style="padding: 6px 0; color: #94a3b8;">Operator / Company:</td><td style="padding: 6px 0; font-weight: 600; color: #ffffff;">{safe_company}</td></tr>
              <tr><td style="padding: 6px 0; color: #94a3b8;">Role:</td><td style="padding: 6px 0;">{safe_role}</td></tr>
              <tr><td style="padding: 6px 0; color: #94a3b8;">Portfolio Scale:</td><td style="padding: 6px 0;">{safe_fleet}</td></tr>
              <tr><td style="padding: 6px 0; color: #94a3b8;">Primary Focus:</td><td style="padding: 6px 0;">{safe_obj}</td></tr>
              <tr><td style="padding: 6px 0; color: #94a3b8;">Timeframe:</td><td style="padding: 6px 0;">{safe_time}</td></tr>
            </table>
            <div style="background-color: #020617; border: 1px solid #1e293b; border-radius: 10px; padding: 14px; font-size: 13px; color: #cbd5e1; margin-bottom: 24px;">
              <strong style="color: #94a3b8; display: block; margin-bottom: 6px;">Notes / Inquiries:</strong>
              {safe_notes}
            </div>
            <a href="{admin_url}" style="display: inline-block; background: #0284c7; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 13px; padding: 11px 22px; border-radius: 10px;">View in WellQC Audit Trail</a>
          </div>
        </body>
        </html>
        """
        admin_text = (
            f"New WellQC Technical Demo Request\n"
            f"Contact: {full_name} <{work_email}>\n"
            f"Company: {company}\n"
            f"Role: {job_title or 'Not specified'}\n"
            f"Portfolio Scale: {fleet_size or 'Not specified'}\n"
            f"Primary Focus: {primary_objective or 'Not specified'}\n"
            f"Timeframe: {timeframe or 'Flexible'}\n"
            f"Notes: {notes or 'None provided'}\n"
        )
        results["adminNotification"] = _dispatch_generic_email(
            to_email=target_admin,
            to_name="WellQC Subsurface Team",
            subject=admin_subject,
            title="New Technical Demonstration Request",
            message_body=admin_text,
            button_text="View Audit Trail",
            action_url=admin_url,
            footer_note=f"Reply directly to {work_email} to confirm calendar scheduling.",
            html_content=admin_html,
            text_content=admin_text,
            config=cfg,
        )

    confirm_subject = "Demo Request Confirmed — WellQC Subsurface Quality Assurance"
    confirm_html = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><title>{confirm_subject}</title></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0b1120; color: #f8fafc; margin: 0; padding: 24px;">
      <div style="max-width: 540px; margin: 0 auto; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 16px; padding: 32px;">
        <div style="color: #10b981; font-size: 20px; font-weight: 800; margin-bottom: 16px;">WellQC</div>
        <div style="color: #ffffff; font-size: 18px; font-weight: 700; margin-bottom: 12px;">We received your technical demo request</div>
        <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">
          Hi {safe_name},<br><br>
          Thank you for requesting a 25-minute technical walkthrough of <strong>WellQC</strong> for <strong>{safe_company}</strong>. A subsurface solutions engineer will reach out within 2 business hours to confirm your calendar slot.
        </p>
        <div style="background-color: #020617; border: 1px solid #1e293b; border-radius: 10px; padding: 14px; font-size: 13px; color: #cbd5e1; margin: 20px 0;">
          <div><strong>Operator / Company:</strong> {safe_company}</div>
          <div><strong>Portfolio Scale:</strong> {safe_fleet}</div>
          <div><strong>Primary Focus:</strong> {safe_obj}</div>
        </div>
        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #1e293b; font-size: 12px; color: #64748b;">
          WellQC Subsurface Analytics • API RP 66 &amp; NUPRC Form WQC-08-A Compliant
        </div>
      </div>
    </body>
    </html>
    """
    confirm_text = (
        f"Hi {full_name},\n\n"
        f"Thank you for requesting a 25-minute technical demonstration of WellQC for {company}.\n"
        f"Portfolio Scale: {fleet_size}\n"
        f"Primary Focus: {primary_objective}\n\n"
        f"A subsurface solutions engineer will reach out within 2 business hours to confirm your calendar invitation.\n"
    )
    results["requesterConfirmation"] = _dispatch_generic_email(
        to_email=work_email,
        to_name=full_name,
        subject=confirm_subject,
        title="Technical Demonstration Request Received",
        message_body=confirm_text,
        button_text="Visit WellQC",
        action_url=base_url,
        footer_note="WellQC Subsurface Analytics • NDA Protected",
        html_content=confirm_html,
        text_content=confirm_text,
        config=cfg,
    )
    return results


def send_contact_inquiry_emails(
    *,
    name: str,
    email: str,
    company: str = "",
    message: str,
    admin_email: Optional[str] = None,
    config: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Send:
    1. Internal support/sales alert email to the WellQC admin inbox (if resolved)
    2. Acknowledgement receipt email to the sender
    """
    cfg = config or get_effective_email_config()
    base_url = (cfg.get("frontend_url") or get_effective_frontend_url()).rstrip("/")
    target_admin = admin_email or resolve_lead_notification_email(config=cfg)

    safe_name = html.escape(name)
    safe_email = html.escape(email)
    safe_company = html.escape(company or "Not specified")
    safe_message = html.escape(message)

    results: Dict[str, Any] = {"adminNotification": None, "senderConfirmation": None}

    if target_admin:
        admin_subject = f"[WellQC Inquiry] {company or name} — {name}"
        admin_url = f"{base_url}/activity"
        admin_html = f"""
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><title>{html.escape(admin_subject)}</title></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0b1120; color: #f8fafc; margin: 0; padding: 24px;">
          <div style="max-width: 560px; margin: 0 auto; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 16px; padding: 32px;">
            <div style="color: #38bdf8; font-size: 20px; font-weight: 800; margin-bottom: 16px;">WellQC Contact Inquiry</div>
            <p style="font-size: 14px; color: #cbd5e1; margin-bottom: 16px;">
              <strong>From:</strong> {safe_name} (<a href="mailto:{safe_email}" style="color: #38bdf8;">{safe_email}</a>)<br>
              <strong>Company:</strong> {safe_company}
            </p>
            <div style="background-color: #020617; border: 1px solid #1e293b; border-radius: 10px; padding: 16px; font-size: 14px; color: #f8fafc; white-space: pre-wrap; margin-bottom: 24px;">{safe_message}</div>
            <a href="{admin_url}" style="display: inline-block; background: #0284c7; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 13px; padding: 11px 22px; border-radius: 10px;">Open Audit Trail</a>
          </div>
        </body>
        </html>
        """
        admin_text = (
            f"New WellQC Contact Inquiry\n"
            f"From: {name} <{email}>\n"
            f"Company: {company or 'Not specified'}\n\n"
            f"Message:\n{message}\n"
        )
        results["adminNotification"] = _dispatch_generic_email(
            to_email=target_admin,
            to_name="WellQC Technical Support",
            subject=admin_subject,
            title="New Contact Inquiry",
            message_body=admin_text,
            button_text="Open Audit Trail",
            action_url=admin_url,
            footer_note=f"Reply directly to {email} to respond.",
            html_content=admin_html,
            text_content=admin_text,
            config=cfg,
        )

    ack_subject = "We Received Your Message — WellQC Technical Support"
    ack_html = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><title>{ack_subject}</title></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0b1120; color: #f8fafc; margin: 0; padding: 24px;">
      <div style="max-width: 540px; margin: 0 auto; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 16px; padding: 32px;">
        <div style="color: #10b981; font-size: 20px; font-weight: 800; margin-bottom: 16px;">WellQC</div>
        <div style="color: #ffffff; font-size: 18px; font-weight: 700; margin-bottom: 12px;">Thank you for reaching out</div>
        <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">
          Hi {safe_name},<br><br>
          We have received your inquiry and routed it to our petrophysical support engineering team. A team member will respond within 2 business hours.
        </p>
        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #1e293b; font-size: 12px; color: #64748b;">
          WellQC Subsurface Analytics • Port Harcourt &amp; Lagos, Nigeria
        </div>
      </div>
    </body>
    </html>
    """
    ack_text = (
        f"Hi {name},\n\n"
        f"We have received your message and routed it to our petrophysical support engineering team. "
        f"One of our engineers will respond within 2 business hours.\n"
    )
    results["senderConfirmation"] = _dispatch_generic_email(
        to_email=email,
        to_name=name,
        subject=ack_subject,
        title="We Received Your Message",
        message_body=ack_text,
        button_text="Visit WellQC",
        action_url=base_url,
        footer_note="WellQC Technical Support",
        html_content=ack_html,
        text_content=ack_text,
        config=cfg,
    )
    return results

