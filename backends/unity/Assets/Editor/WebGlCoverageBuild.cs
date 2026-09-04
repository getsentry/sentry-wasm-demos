using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.Build;
using UnityEngine;

/// <summary>
/// Batch-builds WebGL for each <see cref="WebGLExceptionSupport"/> mode into
/// <c>web/assets/unity/&lt;slug&gt;/</c>.
/// </summary>
public static class WebGlCoverageBuild
{
    const string ScenePath = "Assets/Scenes/Main.unity";

    static readonly (WebGLExceptionSupport Mode, string Slug)[] Modes =
    {
        (WebGLExceptionSupport.None, "none"),
        (WebGLExceptionSupport.ExplicitlyThrownExceptionsOnly, "explicit"),
        (WebGLExceptionSupport.FullWithoutStacktrace, "full-no-stack"),
        (WebGLExceptionSupport.FullWithStacktrace, "full-stack"),
    };

    /// <summary>CI entry: build all four exceptionSupport variants.</summary>
    public static void BuildAll()
    {
        var failures = new List<string>();

        foreach (var (mode, slug) in Modes)
        {
            try
            {
                BuildMode(mode, slug);
            }
            catch (Exception ex)
            {
                failures.Add($"{slug}: {ex.Message}");
                Debug.LogError($"[WebGlCoverageBuild] {slug} failed: {ex}");
            }
        }

        if (failures.Count > 0)
        {
            throw new BuildFailedException(
                $"WebGL coverage build failed for: {string.Join("; ", failures)}");
        }

        Debug.Log("[WebGlCoverageBuild] All exceptionSupport variants built.");
    }

    /// <summary>CI entry: build one mode — pass slug via -exceptionSupport explicit.</summary>
    public static void BuildOne()
    {
        var slug = GetCommandLineValue("-exceptionSupport") ?? "full-stack";
        foreach (var entry in Modes)
        {
            if (entry.Slug != slug)
            {
                continue;
            }

            BuildMode(entry.Mode, entry.Slug);
            return;
        }

        throw new BuildFailedException(
            $"Unknown -exceptionSupport {slug}. Try: {string.Join(", ", Modes.Select(m => m.Slug))}");
    }

    static void BuildMode(WebGLExceptionSupport mode, string slug)
    {
        ApplyWebGlPlayerDefaults();
        ApplyExceptionSupport(mode, slug);

        var outputDir = ResolveOutputDir(slug);
        if (Directory.Exists(outputDir))
        {
            Directory.Delete(outputDir, true);
        }

        Directory.CreateDirectory(outputDir);

        var buildOptions = new BuildPlayerOptions
        {
            scenes = new[] { ScenePath },
            locationPathName = outputDir,
            target = BuildTarget.WebGL,
            options = BuildOptions.Development,
        };

        Debug.Log($"[WebGlCoverageBuild] Building {slug} ({mode}) → {outputDir}");
        var report = BuildPipeline.BuildPlayer(buildOptions);
        if (report.summary.result != UnityEditor.Build.Reporting.BuildResult.Succeeded)
        {
            throw new BuildFailedException(
                $"Build {slug} failed: {report.summary.result} ({report.summary.totalErrors} errors)");
        }

        WriteBuildManifest(outputDir, mode, slug);
        Debug.Log($"[WebGlCoverageBuild] {slug} OK — open web/assets/unity/{slug}/index.html");
    }

    static void ApplyWebGlPlayerDefaults()
    {
        PlayerSettings.companyName = "Sentry";
        PlayerSettings.productName = "WasmUnityCoverage";
        PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Disabled;
        PlayerSettings.WebGL.decompressionFallback = true;
        PlayerSettings.WebGL.dataCaching = false;
        PlayerSettings.WebGL.memoryGrowthMode = WebGLMemoryGrowthMode.Geometric;
    }

    static void ApplyExceptionSupport(WebGLExceptionSupport mode, string slug)
    {
        PlayerSettings.WebGL.exceptionSupport = mode;
        PlayerSettings.bundleVersion = $"wasm-coverage-{slug}";

        var group = NamedBuildTarget.WebGL;
        var defines = PlayerSettings.GetScriptingDefineSymbols(group)
            .Split(new[] { ';' }, StringSplitOptions.RemoveEmptyEntries)
            .Where(define => !define.StartsWith("UNITY_EXCEPTION_SUPPORT_", StringComparison.Ordinal))
            .ToList();

        defines.Add($"UNITY_EXCEPTION_SUPPORT_{mode}");
        PlayerSettings.SetScriptingDefineSymbols(group, string.Join(";", defines));
    }

    static string ResolveOutputDir(string slug)
    {
        var projectRoot = Directory.GetParent(Application.dataPath)?.FullName
            ?? throw new InvalidOperationException("Could not resolve project root");
        return Path.GetFullPath(Path.Combine(projectRoot, "..", "..", "web", "assets", "unity", slug));
    }

    static void WriteBuildManifest(string outputDir, WebGLExceptionSupport mode, string slug)
    {
        var manifestPath = Path.Combine(outputDir, "wasm_harness_build.json");
        var json =
            "{\n" +
            "  \"backend\": \"unity\",\n" +
            $"  \"exception_support\": \"{mode}\",\n" +
            $"  \"exception_support_slug\": \"{slug}\",\n" +
            $"  \"unity_version\": \"{Application.unityVersion}\",\n" +
            $"  \"bundle_version\": \"{PlayerSettings.bundleVersion}\",\n" +
            "  \"development\": true\n" +
            "}\n";
        File.WriteAllText(manifestPath, json);
    }

    static string GetCommandLineValue(string flag)
    {
        var args = Environment.GetCommandLineArgs();
        for (var i = 0; i < args.Length - 1; i++)
        {
            if (args[i] == flag)
            {
                return args[i + 1];
            }
        }

        return null;
    }
}
