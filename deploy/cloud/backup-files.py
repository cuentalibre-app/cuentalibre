"""Write a tar archive of every S3 object version, with a manifest for restores."""

import io
import json
import os
import sys
import tarfile
from contextlib import closing

import boto3
from botocore.config import Config


def record(entry):
    return {
        "key": entry["Key"],
        "versionId": entry["VersionId"],
        "lastModified": entry["LastModified"].isoformat(),
        "isLatest": entry["IsLatest"],
    }


def write_archive(s3, bucket, output):
    manifest = {"format": 1, "bucket": bucket, "versions": [], "deleteMarkers": []}
    pages = s3.get_paginator("list_object_versions").paginate(Bucket=bucket)
    with tarfile.open(fileobj=output, mode="w|", copybufsize=1024 * 1024) as archive:
        for page in pages:
            for entry in page.get("Versions", []):
                version = record(entry)
                version["path"] = f"objects/{len(manifest['versions'])}"
                response = s3.get_object(
                    Bucket=bucket, Key=version["key"], VersionId=version["versionId"]
                )
                with closing(response["Body"]) as body:
                    member = tarfile.TarInfo(version["path"])
                    member.size = entry["Size"]
                    if response["ContentLength"] != member.size:
                        raise ValueError("Object version size differs from the listing")
                    archive.addfile(member, body)

                version["contentType"] = response.get("ContentType", "application/octet-stream")
                version["size"] = member.size
                manifest["versions"].append(version)
            manifest["deleteMarkers"].extend(record(entry) for entry in page.get("DeleteMarkers", []))

        data = json.dumps(manifest).encode("utf-8")
        member = tarfile.TarInfo("manifest.json")
        member.size = len(data)
        archive.addfile(member, io.BytesIO(data))


if __name__ == "__main__":
    source = os.environ["BACKUP_FILES_BUCKET"]
    if source == os.environ["BACKUP_BUCKET"]:
        sys.exit("The files source and backup destination must be different buckets")
    client = boto3.client(
        "s3",
        endpoint_url=os.environ["BACKUP_FILES_ENDPOINT"],
        region_name=os.environ["BACKUP_FILES_REGION"],
        aws_access_key_id=os.environ["BACKUP_FILES_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["BACKUP_FILES_SECRET_ACCESS_KEY"],
        config=Config(s3={"addressing_style": "path"}),
    )
    with closing(client):
        write_archive(client, source, sys.stdout.buffer)
