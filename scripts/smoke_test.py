from __future__ import annotations

import os
import tempfile


with tempfile.TemporaryDirectory() as tmpdir:
    os.environ["CAMPUSVERITE_DB_PATH"] = f"{tmpdir}/campusverite-test.db"

    from campusverite import create_app

    app = create_app("development")
    client = app.test_client()

    assert client.get("/").status_code == 200
    assert client.get("/submit").status_code == 200

    response = client.post(
        "/posts",
        data={
            "category": "equipements",
            "type": "rant",
            "content": "Les salles manquent de prises fonctionnelles pour travailler correctement avec les ordinateurs.",
            "charter": "on",
        },
    )
    assert response.status_code == 302

    home = client.get("/")
    assert home.status_code == 200
    assert b"Radar Campus" in home.data
    assert b"prises fonctionnelles" in home.data

    assert client.post("/posts/1/vote").status_code == 200
    assert client.post("/posts/1/report").status_code == 200

    # Test Admin Login (Invalid)
    invalid_login = client.post("/admin/login", data={"username": "admin", "password": "wrongpassword"})
    assert b"Identifiants invalides" in invalid_login.data

    # Test Admin Login (Valid)
    # Default ADMIN_PASSWORD is "admin123" in DevelopmentConfig
    valid_login = client.post("/admin/login", data={"username": "admin", "password": "admin123"})
    assert valid_login.status_code == 302

    # Test Admin Dashboard Access
    admin_dash = client.get("/admin/dashboard")
    assert admin_dash.status_code == 200
    assert b"Mod\xc3\xa9ration" in admin_dash.data  # "Modération" encoded
    assert b"prises fonctionnelles" in admin_dash.data

    # Test Admin Toggle Visibility
    toggle_resp = client.post("/admin/posts/1/toggle-status")
    assert toggle_resp.status_code == 200
    assert b"hidden" in toggle_resp.data

    # Test Admin Delete Post
    delete_resp = client.post("/admin/posts/1/delete")
    assert delete_resp.status_code == 200

print("Smoke test CampusVerite OK")

